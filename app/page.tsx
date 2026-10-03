'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import bank from './data/bank.json';

type Question = (typeof bank.questions)[number];
type SessionType = 'continue' | 'mistakes' | 'favorites' | 'frequent' | 'random' | 'hardest' | 'sprint';
type Mode = 'study' | 'exam';
type View = 'home' | 'quiz' | 'recap' | 'speed';

type QuestionProgress = {
  seen: number;
  correct: number;
  wrong: number;
  guessed: number;
  streak: number;
  favorite: boolean;
  lastSeen: number;
  nextDue: number;
  reviewStep: number;
  lastResult: 'correct' | 'wrong' | 'guessed' | null;
};

type SavedState = {
  version: number;
  answered: number;
  correct: number;
  progress: Record<string, QuestionProgress>;
  recent: string[];
  recentGroups: string[];
};

const STORAGE_KEY = 'idiom-sprint-progress-v3';
const REVIEW_INTERVALS = [10, 30, 60, 120];
const LETTERS = ['A', 'B', 'C', 'D'];

const EMPTY_STATE: SavedState = {
  version: 1,
  answered: 0,
  correct: 0,
  progress: {},
  recent: [],
  recentGroups: [],
};

function emptyProgress(): QuestionProgress {
  return {
    seen: 0,
    correct: 0,
    wrong: 0,
    guessed: 0,
    streak: 0,
    favorite: false,
    lastSeen: -1,
    nextDue: Number.POSITIVE_INFINITY,
    reviewStep: 0,
    lastResult: null,
  };
}

function statusOf(progress?: QuestionProgress) {
  if (!progress?.seen) return '未测试';
  if (progress.wrong >= 2 || progress.guessed >= 2) return '未掌握';
  if (progress.wrong > 0 || progress.guessed > 0 || progress.streak < 2) return '易错';
  if (progress.streak < 3) return '基本掌握';
  return '已掌握';
}

function pickQuestion(saved: SavedState, sessionType: SessionType, currentId?: string): Question {
  let candidates = bank.questions.filter((question) => question.id !== currentId);
  const progressOf = (question: Question) => saved.progress[question.id] ?? emptyProgress();

  if (sessionType === 'mistakes') {
    const subset = candidates.filter((question) => progressOf(question).wrong > 0 || progressOf(question).guessed > 0);
    if (subset.length) candidates = subset;
  }
  if (sessionType === 'favorites') {
    const subset = candidates.filter((question) => progressOf(question).favorite);
    if (subset.length) candidates = subset;
  }
  if (sessionType === 'frequent') {
    candidates = candidates.filter((question) => question.type === '资料内新编' || question.type === '原始例题');
  }
  if (sessionType === 'hardest') {
    const subset = candidates.filter((question) => {
      const p = progressOf(question);
      return p.wrong + p.guessed > p.correct || question.options.some((option) => option.length > 18);
    });
    if (subset.length) candidates = subset;
  }

  const recentIds = new Set(saved.recent.slice(-8));
  const lastGroup = saved.recentGroups.at(-1);
  const scored = candidates.map((question) => {
    const p = progressOf(question);
    let score = Math.random() * 9;
    if (p.nextDue <= saved.answered) score += 140;
    if (!p.seen) score += sessionType === 'sprint' ? 55 : 34;
    score += p.wrong * 24 + p.guessed * 18;
    if (p.favorite) score += 10;
    if (sessionType === 'random') score = Math.random() * 100;
    if (recentIds.has(question.id)) score -= 90;
    if (question.group === lastGroup) score -= 42;
    if (p.streak >= 3) score -= 20;
    return { question, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.question ?? bank.questions[Math.floor(Math.random() * bank.questions.length)];
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

export default function Home() {
  const [saved, setSaved] = useState<SavedState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>('home');
  const [mode, setMode] = useState<Mode>('study');
  const [sessionType, setSessionType] = useState<SessionType>('continue');
  const [question, setQuestion] = useState<Question>(() => bank.questions[0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Array<{ id: string; selected: number; correct: boolean }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      setSaved(EMPTY_STATE);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved, hydrated]);

  const qProgress = saved.progress[question.id] ?? emptyProgress();
  const answered = selected !== null;
  const isCorrect = selected === question.answer;

  const summary = useMemo(() => {
    const values = Object.values(saved.progress);
    const mastered = values.filter((p) => statusOf(p) === '已掌握').length;
    const review = values.filter((p) => p.wrong > 0 || p.guessed > 0).length;
    const seenGroups = new Set(bank.questions.filter((q) => saved.progress[q.id]?.seen).map((q) => q.group)).size;
    return {
      mastered,
      review,
      accuracy: saved.answered ? Math.round((saved.correct / saved.answered) * 100) : 0,
      seenGroups,
      coverage: Math.round((seenGroups / bank.meta.confusionGroups) * 100),
    };
  }, [saved]);

  const start = useCallback((type: SessionType) => {
    setSessionType(type);
    setSelected(null);
    setShowDetail(false);
    setShowCard(false);
    setExamAnswers([]);
    setQuestion(pickQuestion(saved, type));
    setView('quiz');
  }, [saved]);

  const choose = useCallback((index: number) => {
    if (selected !== null) return;
    setSelected(index);
    const correct = index === question.answer;
    setSaved((current) => {
      const before = current.progress[question.id] ?? emptyProgress();
      const nextAnswered = current.answered + 1;
      const nextStep = correct ? Math.min(before.reviewStep + 1, REVIEW_INTERVALS.length - 1) : 0;
      const nextProgress: QuestionProgress = {
        ...before,
        seen: before.seen + 1,
        correct: before.correct + (correct ? 1 : 0),
        wrong: before.wrong + (correct ? 0 : 1),
        streak: correct ? before.streak + 1 : 0,
        lastSeen: nextAnswered,
        nextDue: nextAnswered + (correct ? REVIEW_INTERVALS[nextStep] : REVIEW_INTERVALS[0]),
        reviewStep: nextStep,
        lastResult: correct ? 'correct' : 'wrong',
      };
      return {
        ...current,
        answered: nextAnswered,
        correct: current.correct + (correct ? 1 : 0),
        progress: { ...current.progress, [question.id]: nextProgress },
        recent: [...current.recent, question.id].slice(-20),
        recentGroups: [...current.recentGroups, question.group].slice(-20),
      };
    });
    if (mode === 'exam') {
      setExamAnswers((items) => [...items, { id: question.id, selected: index, correct }]);
    }
  }, [mode, question, selected]);

  const next = useCallback(() => {
    if (mode === 'exam' && examAnswers.length >= 10) {
      setView('recap');
      return;
    }
    setQuestion(pickQuestion(saved, sessionType, question.id));
    setSelected(null);
    setShowDetail(false);
    setShowCard(false);
  }, [examAnswers.length, mode, question.id, saved, sessionType]);

  const markGuessed = useCallback(() => {
    setSaved((current) => {
      const before = current.progress[question.id] ?? emptyProgress();
      return {
        ...current,
        progress: {
          ...current.progress,
          [question.id]: {
            ...before,
            guessed: before.guessed + 1,
            streak: 0,
            nextDue: current.answered + REVIEW_INTERVALS[0],
            reviewStep: 0,
            lastResult: 'guessed',
          },
        },
      };
    });
  }, [question.id]);

  const toggleFavorite = useCallback(() => {
    setSaved((current) => {
      const before = current.progress[question.id] ?? emptyProgress();
      return {
        ...current,
        progress: { ...current.progress, [question.id]: { ...before, favorite: !before.favorite } },
      };
    });
  }, [question.id]);

  const exportProgress = useCallback(() => {
    const payload = {
      app: 'idiom-sprint',
      exportedAt: new Date().toISOString(),
      data: saved,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idiom-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [saved]);

  const importProgress = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed?.app === 'idiom-sprint' ? parsed.data : parsed;
        if (!incoming || incoming.version !== 1 || typeof incoming.progress !== 'object') {
          throw new Error('invalid');
        }
        setSaved({
          version: 1,
          answered: Number(incoming.answered) || 0,
          correct: Number(incoming.correct) || 0,
          progress: incoming.progress,
          recent: Array.isArray(incoming.recent) ? incoming.recent.slice(-20) : [],
          recentGroups: Array.isArray(incoming.recentGroups) ? incoming.recentGroups.slice(-20) : [],
        });
        window.alert('学习记录已导入');
      } catch {
        window.alert('导入失败，请选择本工具导出的 JSON 文件');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }, []);

  const clearProgress = useCallback(() => {
    if (window.confirm('确定清空当前浏览器中的全部学习记录吗？')) {
      setSaved(EMPTY_STATE);
      setView('home');
    }
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (view !== 'quiz' || showCard) return;
      const key = event.key.toUpperCase();
      const index = ['1', '2', '3', '4'].indexOf(key) >= 0 ? Number(key) - 1 : LETTERS.indexOf(key);
      if (index >= 0 && index <= 3) choose(index);
      if (event.key === 'Enter' && selected !== null) next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [choose, next, selected, showCard, view]);

  const resetExam = () => {
    setExamAnswers([]);
    setQuestion(pickQuestion(saved, sessionType));
    setSelected(null);
    setView('quiz');
  };

  if (!hydrated) return <main className="loading">正在读取本地学习记录…</main>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="返回首页">
          <span className="brand-mark">辨</span>
          <span><strong>成语辨析</strong><small>4 小时冲刺题库</small></span>
        </button>
        <nav className="mode-switch" aria-label="训练模式">
          <button className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>学习模式</button>
          <button className={mode === 'exam' ? 'active' : ''} onClick={() => setMode('exam')}>考试模式</button>
        </nav>
        <button className="quiet-button" onClick={() => setView('speed')}>考前速记</button>
      </header>

      {view !== 'home' && (
        <section className="stats-bar" aria-label="学习进度">
          <Stat label="当前进度" value={`${saved.answered} / ${bank.questions.length}`} />
          <Stat label="正确率" value={`${summary.accuracy}%`} />
          <Stat label="已掌握" value={summary.mastered} />
          <Stat label="待复习" value={summary.review} />
        </section>
      )}

      {view === 'home' && (
        <section className="home">
          <div className="hero-copy">
            <p className="eyebrow">本地自适应训练</p>
            <h1>专练易混边界，<br />用题目建立快速反应。</h1>
            <p className="hero-note">已导入 {bank.meta.identifiedIdioms} 个成语、{bank.meta.confusionGroups} 组易混关系和 {bank.questions.length} 道正式训练题。答题记录仅保存在当前浏览器。</p>
          </div>
          <section className="dashboard-card">
            <div className="dashboard-head">
              <div><span>资料覆盖率</span><strong>{summary.coverage}%</strong></div>
              <div className="progress-track"><i style={{ width: `${summary.coverage}%` }} /></div>
            </div>
            <div className="dashboard-grid">
              <Stat label="已做题" value={saved.answered} />
              <Stat label="正确率" value={`${summary.accuracy}%`} />
              <Stat label="易混组已测" value={summary.seenGroups} />
              <Stat label="剩余未测" value={Math.max(0, bank.meta.confusionGroups - summary.seenGroups)} />
            </div>
          </section>
          <section className="actions" aria-label="训练入口">
            <button className="action primary" onClick={() => start('continue')}><strong>继续训练</strong><span>自动接续当前进度</span></button>
            <button className="action sprint" onClick={() => start('sprint')}><strong>4 小时冲刺</strong><span>优先覆盖未测与易错组</span></button>
            <button className="action" onClick={() => start('mistakes')}><strong>只刷错题</strong><span>{summary.review} 道待复习</span></button>
            <button className="action" onClick={() => start('favorites')}><strong>只刷收藏</strong><span>集中攻克重点题</span></button>
            <button className="action" onClick={() => start('frequent')}><strong>高频易混</strong><span>原题与高频设错</span></button>
            <button className="action" onClick={() => start('random')}><strong>随机综合</strong><span>打乱顺序与位置记忆</span></button>
            <button className="action" onClick={() => start('hardest')}><strong>最难辨析</strong><span>优先复现高干扰项</span></button>
            <button className="action" onClick={() => setView('speed')}><strong>考前速记</strong><span>根据真实错题生成</span></button>
          </section>
          <section className="data-tools" aria-label="学习记录管理">
            <div><strong>学习记录</strong><span>换电脑时可先导出，再在新浏览器中导入。</span></div>
            <button onClick={exportProgress}>导出学习记录</button>
            <label className="import-button">导入学习记录<input type="file" accept="application/json,.json" onChange={importProgress} /></label>
            <button className="danger-button" onClick={clearProgress}>清空我的学习记录</button>
          </section>
        </section>
      )}

      {view === 'quiz' && (
        <section className="quiz-wrap">
          <div className="question-meta">
            <span>{mode === 'study' ? '学习模式' : `考试模式 ${examAnswers.length + (answered ? 0 : 1)} / 10`}</span>
            <span>{question.source}</span>
            <button className={qProgress.favorite ? 'favorite on' : 'favorite'} onClick={toggleFavorite}>{qProgress.favorite ? '★ 已收藏' : '☆ 收藏'}</button>
          </div>
          <article className="question-card">
            {mode === 'study' && qProgress.seen === 0 && <div className="primer"><strong>首次辨析</strong><span>{question.group}</span></div>}
            <p className="question-label">{question.type}</p>
            <h2>{question.prompt}</h2>
            <p className="instruction">请选择最恰当的选项</p>
            <div className="options">
              {question.options.map((option, index) => {
                const state = answered ? (index === question.answer ? 'correct' : index === selected ? 'wrong' : 'muted') : '';
                return (
                  <button key={`${question.id}-${index}`} className={`option ${state}`} onClick={() => choose(index)} disabled={answered}>
                    <b>{LETTERS[index]}</b><span>{option}</span><kbd>{index + 1}</kbd>
                  </button>
                );
              })}
            </div>
          </article>
          {answered && (
            <section className={`feedback ${isCorrect ? 'good' : 'bad'}`} aria-live="polite">
              <div className="feedback-title">
                <strong>{isCorrect ? '✓ 正确' : '✗ 错误'}</strong>
                {!isCorrect && <span>正确答案 {LETTERS[question.answer]} {question.options[question.answer]}</span>}
              </div>
              {mode === 'study' ? (
                <div className="analysis">
                  <section><h3>核心辨析</h3><p>{question.core}</p></section>
                  <section><h3>本题判断</h3><p>{question.analysis}</p></section>
                  <section className="quick"><h3>快速判断</h3><p>{question.quick}</p></section>
                  {showDetail && <section className="detail"><h3>再讲一次</h3><p>{question.detail}</p></section>}
                </div>
              ) : <p className="exam-note">本组完成 10 题后统一查看解析。</p>}
              <div className="feedback-actions">
                <button className="next-button" onClick={next}>下一题 <span>Enter</span></button>
                {mode === 'study' && <button onClick={() => setShowDetail((value) => !value)}>没懂，再讲一次</button>}
                {isCorrect && <button onClick={markGuessed} disabled={qProgress.lastResult === 'guessed'}>这题我是蒙对的</button>}
                <button onClick={() => setShowCard(true)}>查看辨析</button>
              </div>
            </section>
          )}
        </section>
      )}

      {view === 'recap' && (
        <section className="recap">
          <p className="eyebrow">考试模式本组小结</p>
          <h1>{examAnswers.filter((item) => item.correct).length} / {examAnswers.length}</h1>
          <div className="recap-list">
            {examAnswers.map((item, index) => {
              const q = bank.questions.find((candidate) => candidate.id === item.id)!;
              return <div key={`${item.id}-${index}`}><b>{item.correct ? '✓' : '✗'} {index + 1}</b><span>{q.group}</span><p>{q.quick}</p></div>;
            })}
          </div>
          <div className="recap-buttons"><button className="next-button" onClick={resetExam}>再做一组</button><button onClick={() => setView('home')}>返回首页</button></div>
        </section>
      )}

      {view === 'speed' && (
        <section className="speed-page">
          <div className="speed-head"><div><p className="eyebrow">基于真实答题记录</p><h1>考前速记</h1></div><button onClick={() => setView('home')}>返回首页</button></div>
          {summary.review === 0 ? <div className="empty-state">完成几题后，这里会自动收录你的错题、蒙对题和收藏题。</div> : (
            <div className="speed-list">
              {bank.questions.filter((q) => {
                const p = saved.progress[q.id];
                return p && (p.wrong > 0 || p.guessed > 0 || p.favorite) && p.streak < 3;
              }).sort((a, b) => {
                const pa = saved.progress[a.id];
                const pb = saved.progress[b.id];
                return pb.wrong + pb.guessed - pa.wrong - pa.guessed;
              }).map((q) => {
                const p = saved.progress[q.id];
                return <article key={q.id}><div><strong>{q.group}</strong><span>错 {p.wrong} · 蒙 {p.guessed} · {statusOf(p)}</span></div><p>{q.quick}</p></article>;
              })}
            </div>
          )}
        </section>
      )}

      {showCard && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowCard(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-label="易混辨析卡" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCard(false)} aria-label="关闭">×</button>
            <p className="eyebrow">易混词卡</p>
            <h2>{question.group}</h2>
            <div><h3>最核心区别</h3><p>{question.core}</p></div>
            <div><h3>典型语境</h3><p>{question.quick}</p></div>
            <div><h3>易错提醒</h3><p>{question.detail}</p></div>
            <button className="next-button" onClick={() => setShowCard(false)}>记住了</button>
          </section>
        </div>
      )}
    </main>
  );
}
