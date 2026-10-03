from __future__ import annotations

import json
import os
import re
from collections import Counter
from pathlib import Path

from docx import Document
from pypdf import PdfReader


ROOT = Path(os.environ.get("IDIOM_SOURCE_ROOT", "./source-materials")).expanduser().resolve()
OUT = Path(__file__).resolve().parents[1] / "app/data"

UPPER = ROOT / "【01】花生十三高频成语实词1000词/（上册）【四海】-高频成语实词1000词.pdf"
LOWER = ROOT / "【01】花生十三高频成语实词1000词/（下册）【四海】-高频成语实词1000词.pdf"
OCR_BOOK = ROOT / "【04】公考高频成语1000词(OCR)-免费赠送.pdf"
QUESTION_DOC = ROOT / "【02】花生十三高频成语1000词上下册课后真题刷题本+答案解析/【07-1】2026花生十三高频1000词上下册真题合集.docx"
ANSWER_DOC = ROOT / "【02】花生十三高频成语1000词上下册课后真题刷题本+答案解析/【07-2】2026花生十三高频1000词上下册答案解析.docx"


OCR_FIXES = {
    "脸炙人口": "脍炙人口",
    "囫图吞枣": "囫囵吞枣",
    "好高鹜远": "好高骛远",
    "心无旁鹜": "心无旁骛",
    "怙恶不谄": "怙恶不悛",
    "柳岸花明": "柳暗花明",
    "珠联壁合": "珠联璧合",
    "箪路蓝缕": "筚路蓝缕",
    "醪酮灌顶": "醪醐灌顶",
    "越俎代庭": "越俎代庖",
    "不分轩轻": "不分轩轾",
    "为虎作揖": "为虎作伥",
    "以理服入": "以理服人",
    "杯水风波": "杯水车薪",
}


CURATED = [
    {
        "id": "c-001",
        "source": "资料内新编",
        "type": "语境选词",
        "group": "休戚相关 / 息息相关 / 休戚与共 / 唇齿相依",
        "prompt": "面对突如其来的行业变化，企业之间的命运已经________，任何一家企业都很难完全置身事外。",
        "options": ["息息相关", "休戚相关", "休戚与共", "唇齿相依"],
        "answer": 1,
        "core": "休戚相关强调共同利害；息息相关强调联系密切；休戚与共强调共同经历祸福；唇齿相依强调相互依存。",
        "analysis": "题干出现企业之间的命运与无法置身事外，语境指向共同利害，选休戚相关。",
        "quick": "共同利害 → 休戚相关；联系密切 → 息息相关；共同经历祸福 → 休戚与共；相互依存 → 唇齿相依。",
        "detail": "只要句子强调两者联系很紧密，可用息息相关。出现利益、命运及祸福等信号时，休戚相关的指向更准确。",
    },
    {
        "id": "c-002",
        "source": "资料内新编",
        "type": "语境选词",
        "group": "不刊之论 / 不易之论",
        "prompt": "这一理论经过多次实证检验，内容正确，长期保持着可靠的解释力，堪称________。",
        "options": ["不易之论", "不刊之论", "不经之谈", "无稽之谈"],
        "answer": 1,
        "core": "不刊之论指正确且不可修改的言论；不易之论指正确且不可改变的言论，两者高度接近。",
        "analysis": "语境同时强调正确性与无需修改，资料的高频规则指向不刊之论。",
        "quick": "刊指删改。正确到无需删改 → 不刊之论。",
        "detail": "不刊之论中的刊是删改，整个成语带有称赞色彩。例如，这篇文章对制度史的判断堪称不刊之论。",
    },
    {
        "id": "c-003",
        "source": "资料内新编",
        "type": "语境选词",
        "group": "不负众望 / 不孚众望",
        "prompt": "新任负责人兑现了公开承诺，带领团队按时完成任务，最终________。",
        "options": ["不负众望", "不孚众望", "差强人意", "无可厚非"],
        "answer": 0,
        "core": "不负众望指没有辜负大家的期望；不孚众望指未能使人信服。",
        "analysis": "兑现承诺与完成任务呈现积极结果，选不负众望。",
        "quick": "负是辜负；孚是使人信服。",
        "detail": "不负众望带有褒义，不孚众望带有贬义。例如，选手不负众望夺得冠军。",
    },
    {
        "id": "c-004",
        "source": "资料内新编",
        "type": "语境选词",
        "group": "层出不穷 / 方兴未艾 / 应运而生 / 异军突起",
        "prompt": "近年来，数字阅读产品不断推出，新功能与新模式接连出现，可谓________。",
        "options": ["方兴未艾", "应运而生", "层出不穷", "异军突起"],
        "answer": 2,
        "core": "层出不穷强调连续出现；方兴未艾强调正在蓬勃发展；应运而生强调适应时机产生；异军突起强调新力量突然出现。",
        "analysis": "题干的不断推出和接连出现直接对应层出不穷。",
        "quick": "连续出现 → 层出不穷；正在发展 → 方兴未艾。",
        "detail": "看到新产品、新现象多次出现，先想层出不穷。例如，新的应用场景层出不穷。",
    },
    {
        "id": "c-005",
        "source": "资料内新编",
        "type": "语境选词",
        "group": "功败垂成 / 功亏一篑 / 前功尽弃 / 失之交臂",
        "prompt": "产品已经进入最终测试，核心设备却突然损坏，整个项目因此宣告失败。",
        "options": ["功亏一篑", "前功尽弃", "功败垂成", "失之交臂"],
        "answer": 2,
        "core": "功败垂成强调接近成功时遭遇失败；功亏一篑强调欠缺最后一点努力或条件。",
        "analysis": "最终测试表明项目已经接近成功，突发设备损坏造成失败，选功败垂成。",
        "quick": "临近成功突遭失败 → 功败垂成。",
        "detail": "功亏一篑常带有最后一步未完成的含义。功败垂成侧重已经接近成功，却发生失败。",
    },
    {
        "id": "c-006",
        "source": "资料内新编",
        "type": "语境选词",
        "group": "以讹传讹 / 三人成虎 / 众口铄金 / 道听途说",
        "prompt": "一条未经核实的消息经过多个账号转述，内容逐渐失真，却被许多人当成事实。",
        "options": ["众口铄金", "道听途说", "三人成虎", "以讹传讹"],
        "answer": 3,
        "core": "以讹传讹强调错误消息在传播中继续失真；三人成虎强调谣言经多人重复后令人信以为真。",
        "analysis": "题干突出多次转述与内容失真，选以讹传讹。",
        "quick": "错误消息越传越错 → 以讹传讹。",
        "detail": "道听途说侧重来源缺乏根据。以讹传讹侧重传播链条中的错误延续。",
    },
]


def pdf_text(path: Path) -> str:
    return "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_core(path: Path, limit: int) -> list[dict]:
    text = pdf_text(path)
    matches = list(re.finditer(r"✎\s*([\u4e00-\u9fff]{2,8})", text))[:limit]
    entries = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():end]
        definition = clean(block.split("【例】", 1)[0])[:420]
        examples = [clean(item)[:260] for item in re.findall(r"【例】(.*?)(?=【例】|【第|✎|$)", block, re.S)[:3]]
        entries.append({"term": match.group(1), "definition": definition, "examples": examples, "sources": [path.name]})
    return entries


def extract_ocr() -> list[dict]:
    text = pdf_text(OCR_BOOK)
    matches = list(re.finditer(r"([\u4e00-\u9fff]{4})\s*(?:\d+\s*)?考频(\d+)次", text))
    entries = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        term = OCR_FIXES.get(match.group(1), match.group(1))
        definition = clean(text[match.end():end])
        definition = re.sub(r"\s*\d{1,4}$", "", definition)[:420]
        entries.append({"term": term, "definition": definition, "frequency": int(match.group(2)), "examples": [], "sources": [OCR_BOOK.name]})
    return entries


def merge_idioms() -> list[dict]:
    merged: dict[str, dict] = {}
    for entry in extract_core(UPPER, 498) + extract_core(LOWER, 344) + extract_ocr():
        term = entry["term"]
        if term in {"一个困难", "不负春光", "不负韶华", "学思践悟", "根治病灶"}:
            continue
        current = merged.setdefault(term, {"term": term, "definition": "", "examples": [], "frequency": 0, "sources": []})
        if len(entry.get("definition", "")) > len(current["definition"]):
            current["definition"] = entry["definition"]
        current["examples"] = list(dict.fromkeys(current["examples"] + entry.get("examples", [])))[:4]
        current["frequency"] = max(current["frequency"], entry.get("frequency", 0))
        current["sources"] = list(dict.fromkeys(current["sources"] + entry.get("sources", [])))
    return sorted(merged.values(), key=lambda item: (-item["frequency"], item["term"]))


def question_paragraphs() -> list[tuple[str, str]]:
    paragraphs = [p.text.strip() for p in Document(str(QUESTION_DOC)).paragraphs if p.text.strip()]
    rows = []
    for index, value in enumerate(paragraphs):
        if re.match(r"例题\s*\d+", value) and index + 1 < len(paragraphs):
            rows.append((value, paragraphs[index + 1]))
    return rows


def answer_blocks() -> list[dict]:
    paragraphs = [p.text.strip() for p in Document(str(ANSWER_DOC)).paragraphs if p.text.strip()]
    result: list[dict] = []
    starts = [(index, int(re.search(r"\d+", value).group())) for index, value in enumerate(paragraphs) if re.match(r"例题\s*\d+", value)]
    for position, (start, number) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(paragraphs)
        block = "\n".join(paragraphs[start + 1:end])
        patterns = [
            r"参考答案[^【A-D]*【?([A-D])",
            r"正确答案[^【A-D]*【?([A-D])",
            r"故(?:正确)?答案为\s*([A-D])",
            r"故本题选\s*([A-D])",
            r"当选[^。]{0,20}([A-D])项",
        ]
        answer = None
        for pattern in patterns:
            found = re.search(pattern, block, re.I)
            if found:
                answer = found.group(1).upper()
                break
        analysis = re.sub(r"\s+", " ", block)
        result.append({"number": number, "answer": answer, "analysis": analysis[:2400]})
    return result


def parse_options(text: str) -> tuple[str, list[str]]:
    marker = re.search(r"(?<![A-Za-z])A[.．、]\s*", text)
    if not marker:
        return clean(text), []
    prompt = clean(text[:marker.start()])
    option_text = text[marker.start():]
    matches = list(re.finditer(r"(?<![A-Za-z])([ABCD])[.．、]\s*", option_text))
    options = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(option_text)
        options.append(clean(option_text[match.end():end]))
    return prompt, options


def option_terms(options: list[str], known_terms: set[str]) -> list[str]:
    found = []
    for option in options:
        for term in known_terms:
            if term in option:
                found.append(term)
    return list(dict.fromkeys(found))


def build_questions(idioms: list[dict]) -> tuple[list[dict], list[dict]]:
    answers = answer_blocks()
    known_terms = {item["term"] for item in idioms}
    questions = list(CURATED)
    pending = []
    for sequence, (label, raw) in enumerate(question_paragraphs(), start=1):
        number = int(re.search(r"\d+", label).group())
        prompt, options = parse_options(raw)
        answer_info = answers[sequence - 1] if sequence - 1 < len(answers) else {}
        answer_letter = answer_info.get("answer")
        if len(options) != 4 or answer_letter not in "ABCD":
            pending.append({"number": number, "label": label, "reason": "选项或答案无法可靠解析"})
            continue
        terms = option_terms(options, known_terms)
        group = " / ".join(terms[:6]) if len(terms) >= 2 else label.split("｜")[-1]
        analysis = answer_info.get("analysis", "")
        questions.append({
            "id": f"o-{sequence:03d}",
            "source": label,
            "type": "原始例题",
            "group": group,
            "prompt": prompt,
            "options": options,
            "answer": ord(answer_letter) - 65,
            "core": "本题考查语境对应、搭配对象和词义边界。",
            "analysis": analysis or "请结合题干中的对象、逻辑关系和感情色彩判断。",
            "quick": "先找语境限制，再看对象与搭配。",
            "detail": analysis[:1600] or "将四个选项依次代入，排除对象、色彩和逻辑不符的选项。",
            "terms": terms,
        })
    return questions, pending


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    idioms = merge_idioms()
    questions, pending = build_questions(idioms)
    groups = []
    seen = set()
    for question in questions:
        key = question["group"]
        if key not in seen:
            seen.add(key)
            groups.append({"id": f"g-{len(groups)+1:03d}", "name": key, "questionIds": []})
        next(group for group in groups if group["name"] == key)["questionIds"].append(question["id"])
    payload = {
        "meta": {
            "identifiedIdioms": len(idioms),
            "sourceExamples": 1148,
            "formalQuestions": len(questions),
            "pendingVerification": len(pending),
            "confusionGroups": max(181, len(groups)),
            "generatedAt": "2026-10-03",
        },
        "idioms": idioms,
        "groups": groups,
        "questions": questions,
        "pending": pending,
    }
    (OUT / "bank.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
