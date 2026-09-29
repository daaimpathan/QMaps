from __future__ import annotations

import csv
import math
import os
import subprocess
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"C:\Users\daaim\OneDrive\Desktop\QMaps")
OUTPUT = ROOT / "reports" / "QMaps_Technical_Report.docx"
BUILD = Path(r"C:\Users\daaim\AppData\Local\Temp\qmaps-report-build")
PYTHON = Path(r"C:\Users\daaim\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
NODE = Path(r"C:\Users\daaim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
NODE_MODULES = Path(r"C:\Users\daaim\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules")
SKILL_ROOT = Path(r"C:\Users\daaim\.codex\plugins\cache\openai-primary-runtime\documents\26.923.10815\skills\documents")
RENDER_DOCX = SKILL_ROOT / "render_docx.py"

GREEN = "56683C"
DARK = "20251C"
MUTED = "6F716C"
SAND = "F3F0E7"
PALE_GREEN = "EFF2E8"
RULE = "D9D9D9"
WHITE = "FFFFFF"


def seq(*parts):
    return ("seq", parts)


def sub(base, index):
    return ("sub", base, index)


def sup(base, power):
    return ("sup", base, power)


def subsup(base, index, power):
    return ("subsup", base, index, power)


def frac(num, den):
    return ("frac", num, den)


def sqrt(content):
    return ("sqrt", content)


def nary(symbol, lower, upper, content):
    return ("nary", symbol, lower, upper, content)


def bar(content):
    return ("bar", content)


def paren(content):
    return ("delim", "(", content, ")")


EQUATIONS = {
    "distance": seq(sub("d", "ij"), " = ", sqrt(seq(sup(paren(seq(sub("x", "i"), " − ", sub("x", "j"))), "2"), " + ", sup(paren(seq(sub("y", "i"), " − ", sub("y", "j"))), "2")))),
    "objective": seq("min  ", nary("∑", "k∈K, i∈V, j∈V", "", seq(sub("c", "ij"), " ", sub("x", "ijk")))),
    "visit_once": seq(nary("∑", "k∈K, j∈V∖{i}", "", sub("x", "ijk")), " = 1   ∀ i∈C"),
    "flow": seq(nary("∑", "j∈V∖{i}", "", sub("x", "jik")), " = ", nary("∑", "j∈V∖{i}", "", sub("x", "ijk")), " = ", sub("z", "ik")),
    "depot": seq(nary("∑", "j∈C", "", sub("x", "0jk")), " = ", sub("u", "k"), " = ", nary("∑", "i∈C", "", sub("x", "i0k")), "   ∀k∈K"),
    "capacity": seq(nary("∑", "i∈C", "", seq(sub("q", "i"), " ", sub("z", "ik"))), " ≤ ", sub("Q", "k"), "   ∀k∈K"),
    "domains": seq("xᵢⱼₖ, zᵢₖ, uₖ ∈ {0,1} ;   Tᵢₖ ≥ 0"),
    "time_propagation": seq(sub("T", "jk"), " ≥ ", sub("T", "ik"), " + ", sub("s", "i"), " + ", sub("τ", "ij"), " − M(1 − ", sub("x", "ijk"), ")"),
    "time_bounds": seq(sub("a", "i"), " − M(1 − ", sub("z", "ik"), ") ≤ ", sub("T", "ik"), " ≤ ", sub("b", "i"), " + M(1 − ", sub("z", "ik"), ")"),
    "service_clock": seq(sub("A", "i"), " = ", sub("D", "prev"), " + ", sub("τ", "prev,i"), " ;   ", sub("S", "i"), " = max(", sub("A", "i"), ", ", sub("a", "i"), ")"),
    "wait_depart": seq(sub("W", "i"), " = max(0, ", sub("a", "i"), " − ", sub("A", "i"), ") ;   ", sub("D", "i"), " = ", sub("S", "i"), " + ", sub("s", "i")),
    "keys": seq("π = argsort(x) ;   ", sub("π", "r"), " ∈ {1,…,n}"),
    "segment_distance": seq(sub("ℓ", "ij"), " = ", sub("d", "0,sᵢ"), " + ", nary("∑", "r=i", "j−1", sub("d", "sᵣ,sᵣ₊₁")), " + ", sub("d", "sⱼ,0")),
    "segment_capacity": seq(nary("∑", "r=i", "j", sub("q", "sᵣ")), " ≤ Q"),
    "split_dp": seq(sub("F", "j"), " = min", " { ", sub("F", "i"), " + ", sub("ℓ", "ij"), " : 0≤i<j and segment(i,j) feasible }"),
    "split_fleet": seq(sub("F", "k,j"), " = min", " { ", sub("F", "k−1,i"), " + ", sub("ℓ", "ij"), " : i<j and segment(i,j) feasible }"),
    "return_window": seq(sub("D", "last"), " + ", sub("τ", "last,0"), " ≤ ", sub("b", "0")),
    "priority_objective": seq("J = D + γ ", nary("∑", "i∈C", "", seq(sub("w", "i"), " ", frac(sub("S", "i"), "60")))),
    "pso_velocity": seq(sub("v", "i"), "(t+1) = ω ", sub("v", "i"), "(t) + c₁r₁(", sub("p", "i"), " − ", sub("x", "i"), ") + c₂r₂(g − ", sub("x", "i"), ")"),
    "pso_position": seq(sub("x", "i"), "(t+1) = ", sub("x", "i"), "(t) + ", sub("v", "i"), "(t+1)"),
    "qpso_attractor": seq(sub("p", "i"), " = φ ", sub("pbest", "i"), " + (1−φ) ", "gbest"),
    "qpso_mbest": seq("mbest = ", frac(nary("∑", "i=1", "N", sub("pbest", "i")), "N")),
    "qpso_beta": seq("β(t) = 1 − 0.5 ", frac("t", "T")),
    "qpso_update": seq(sub("x", "i"), "(t+1) = ", sub("p", "i"), " ± β(t) |mbest − ", sub("x", "i"), "(t)| ln(1/u)"),
    "aco_transition": seq(subsup("P", "ij", "k"), " = ", frac(seq(sup(sub("τ", "ij"), "α"), " ", sup(sub("η", "ij"), "β")), nary("∑", "l∈Uₖ", "", seq(sup(sub("τ", "il"), "α"), " ", sup(sub("η", "il"), "β"))))),
    "aco_eta": seq(sub("η", "ij"), " = ", frac("1", sub("d", "ij"))),
    "aco_update": seq(sub("τ", "ij"), "(t+1) = (1−ρ)", sub("τ", "ij"), "(t) + ", subsup("Δτ", "ij", "k"), " ;   ", subsup("Δτ", "ij", "k"), " = Q / ", sub("L", "k")),
    "qaco_state": seq("|", sub("ψ", "ij"), "⟩ = cos(", sub("θ", "ij"), ")|0⟩ + sin(", sub("θ", "ij"), ")|1⟩"),
    "qaco_measure": seq(sub("q", "ij"), " = sin²(", sub("θ", "ij"), ") ;   ", subsup("P", "ij", "k"), " ∝ ", sup(sub("q", "ij"), "α"), " ", sup(sub("η", "ij"), "β")),
    "qaco_temp": seq("T(t) = max(0.05, 1 − t/I) ;   ", sub("ΔE", "k"), " = max(0, ", sub("L", "k"), " − ", sub("L", "best"), ")"),
    "qaco_rotation": seq(sub("Δθ", "k"), " = min(π/8, (π/2) exp(−α ", frac(sub("ΔE", "k"), "T"), "))"),
    "qaco_theta": seq(sub("θ", "ij"), " ← clip(", sub("θ", "ij"), " + ", sub("Δθ", "k"), ", 10⁻⁶, π/2−10⁻⁶)"),
    "hybrid_budget": seq("I", sub("QACO", ""), " = max(1, ⌊0.4 I⌋) ;   I", sub("QPSO", ""), " = I − I", sub("QACO", "")),
    "traffic_adjust": seq(sub("τ", "ij"), "′ = ", sub("τ", "ij"), "(1 + δ", sub("ij", ""), ") ;   δ", sub("ij", ""), " ≥ 0"),
    "closure": seq(sub("τ", "ij"), "′ = τ", sub("ij", ""), " + P", sub("close", ""), "   (large finite penalty in manual closure mode)"),
    "urban_speed": seq(sub("τ", "ij"), "base = 60 ", frac(sub("d", "ij"), "25"), "   minutes, with distance in km"),
    "street_eta": seq(sub("m", "ij"), " = max(1, ", frac(sub("τ", "configured"), sub("τ", "base")), ") ;   ", sub("τ", "street"), " = max(", sub("τ", "OSRM"), ", 60 ", frac(sub("d", "road"), "25"), ") ", sub("m", "ij")),
    "route_eta": seq(sub("T", "route"), " = ", nary("∑", "legs", "", sub("τ", "leg")), " + ", nary("∑", "i∈C", "", seq(sub("s", "i"), " + ", sub("W", "i")))),
    "mean": seq("C̄", " = ", frac(nary("∑", "r=1", "R", sub("C", "r")), "R")),
    "sample_sd": seq("s = ", sqrt(frac(nary("∑", "r=1", "R", sup(paren(seq(sub("C", "r"), " − C̄")), "2")), "R−1"))),
    "paired_diff": seq(sub("d", "r"), " = ", sub("C", "A,r"), " − ", sub("C", "B,r")),
    "wilcoxon": seq("W⁺ = ", nary("∑", "r:dᵣ>0", "", sub("R", "r")), " ;   p = P(|W| ≥ |W", sub("obs", ""), "| | H₀)"),
    "friedman": seq("χ²", sub("F", ""), " = ", frac("12N", "k(k+1)"), " ", nary("∑", "j=1", "k", sup(paren(sub("R̄", "j")), "2")), " − 3N(k+1)"),
    "cohens_d": seq("d = ", frac(seq(sub("C̄", "A"), " − ", sub("C̄", "B")), sub("s", "p"))),
    "pooled_sd": seq(sub("s", "p"), " = ", sqrt(frac(seq("(", sub("n", "A"), "−1)", sup(sub("s", "A"), "2"), " + (", sub("n", "B"), "−1)", sup(sub("s", "B"), "2")), seq(sub("n", "A"), " + ", sub("n", "B"), " − 2")))),
    "shapiro": seq("W = ", frac(sup(paren(nary("∑", "i=1", "R", seq(sub("a", "i"), sub("x", "(i)")))), "2"), nary("∑", "i=1", "R", sup(paren(seq(sub("x", "(i)"), " − x̄")), "2")))),
    "paired_dz": seq("d", sub("z", ""), " = ", frac(bar(sub("d", "r")), sub("s", "d"))),
    "nemenyi": seq("CD = q", sub("α", ""), " ", sqrt(frac("k(k+1)", "6N"))),
}


def _math_run(text: str):
    node = OxmlElement("m:r")
    text_node = OxmlElement("m:t")
    text_node.set(qn("xml:space"), "preserve")
    text_node.text = text
    node.append(text_node)
    return node


def _box(tag: str, child):
    node = OxmlElement(tag)
    if isinstance(child, tuple) and child[0] == "seq":
        for item in child[1]:
            node.append(_math_node(item))
    else:
        node.append(_math_node(child))
    return node


def _math_node(value):
    if isinstance(value, str):
        return _math_run(value)
    op = value[0]
    if op == "seq":
        node = OxmlElement("m:oMath")
        for item in value[1]:
            node.append(_math_node(item))
        return node
    if op == "sub":
        node = OxmlElement("m:sSub")
        node.append(_box("m:e", value[1]))
        node.append(_box("m:sub", value[2]))
        return node
    if op == "sup":
        node = OxmlElement("m:sSup")
        node.append(_box("m:e", value[1]))
        node.append(_box("m:sup", value[2]))
        return node
    if op == "subsup":
        node = OxmlElement("m:sSubSup")
        node.append(_box("m:e", value[1]))
        node.append(_box("m:sub", value[2]))
        node.append(_box("m:sup", value[3]))
        return node
    if op == "frac":
        node = OxmlElement("m:f")
        node.append(_box("m:num", value[1]))
        node.append(_box("m:den", value[2]))
        return node
    if op == "sqrt":
        node = OxmlElement("m:rad")
        props = OxmlElement("m:radPr")
        hide = OxmlElement("m:degHide")
        hide.set(qn("m:val"), "on")
        props.append(hide)
        node.append(props)
        node.append(OxmlElement("m:deg"))
        node.append(_box("m:e", value[1]))
        return node
    if op == "nary":
        node = OxmlElement("m:nary")
        props = OxmlElement("m:naryPr")
        char = OxmlElement("m:chr")
        char.set(qn("m:val"), value[1])
        props.append(char)
        location = OxmlElement("m:limLoc")
        location.set(qn("m:val"), "undOvr")
        props.append(location)
        node.append(props)
        node.append(_box("m:sub", value[2]))
        node.append(_box("m:sup", value[3]))
        node.append(_box("m:e", value[4]))
        return node
    if op == "bar":
        node = OxmlElement("m:bar")
        props = OxmlElement("m:barPr")
        position = OxmlElement("m:pos")
        position.set(qn("m:val"), "top")
        props.append(position)
        node.append(props)
        node.append(_box("m:e", value[1]))
        return node
    if op == "delim":
        node = OxmlElement("m:d")
        props = OxmlElement("m:dPr")
        begin = OxmlElement("m:begChr")
        begin.set(qn("m:val"), value[1])
        end = OxmlElement("m:endChr")
        end.set(qn("m:val"), value[3])
        props.extend([begin, end])
        node.append(props)
        node.append(_box("m:e", value[2]))
        return node
    raise ValueError(f"Unknown math node: {op}")


def add_equation(doc: Document, key: str, number: int, width: float = 6.2):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.keep_with_next = True
    math = _math_node(EQUATIONS[key])
    p._p.append(math)
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    cap.paragraph_format.space_after = Pt(4)
    r = cap.add_run(f"({number})")
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(MUTED)


def add_page_field(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    display = OxmlElement("w:t")
    display.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, display, end])


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in [("top", top), ("start", start), ("bottom", bottom), ("end", end)]:
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), RULE)


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_table(doc, headers, rows, widths=None, font_size=8.8, alignments=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.autofit = False
    table.allow_autofit = False
    if widths:
        for col, width in zip(table.columns, widths):
            col.width = Inches(width)
        tbl_w = table._tbl.tblPr.find(qn("w:tblW"))
        tbl_w.set(qn("w:w"), str(round(sum(widths) * 1440)))
        tbl_w.set(qn("w:type"), "dxa")
    head = table.rows[0]
    repeat_header(head)
    for idx, text in enumerate(headers):
        cell = head.cells[idx]
        cell.text = str(text)
        if widths:
            cell.width = Inches(widths[idx])
        set_cell_shading(cell, GREEN)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_margins(cell)
        for p in cell.paragraphs:
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if not alignments else alignments[idx]
            for run in p.runs:
                run.bold = True
                run.font.name = "Calibri"
                run.font.size = Pt(font_size)
                run.font.color.rgb = RGBColor.from_string(WHITE)
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        for idx, value in enumerate(row):
            cells[idx].text = str(value)
            cells[idx].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cells[idx])
            if ridx % 2 == 1:
                set_cell_shading(cells[idx], SAND)
            if widths:
                cells[idx].width = Inches(widths[idx])
            for p in cells[idx].paragraphs:
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.05
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT if not alignments else alignments[idx]
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(font_size)
                    run.font.color.rgb = RGBColor.from_string(DARK)
    set_table_borders(table)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    rid = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rid)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), GREEN)
    props.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    props.append(underline)
    run.append(props)
    text_node = OxmlElement("w:t")
    text_node.text = text
    run.append(text_node)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def add_reference(doc, number, citation, link_label, url):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.25)
    p.paragraph_format.first_line_indent = Inches(-0.25)
    p.paragraph_format.space_after = Pt(5)
    r = p.add_run(f"[{number}] ")
    r.bold = True
    r.font.color.rgb = RGBColor.from_string(GREEN)
    p.add_run(citation + " ")
    add_hyperlink(p, link_label, url)


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.27)
    p.paragraph_format.first_line_indent = Inches(-0.14)
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p


def configure(doc: Document):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.68)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)
    section.header_distance = Inches(0.32)
    section.footer_distance = Inches(0.32)
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.4)
    normal.font.color.rgb = RGBColor.from_string(DARK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.12
    for style_name, size, color in [
        ("Title", 28, DARK),
        ("Heading 1", 18, DARK),
        ("Heading 2", 13, DARK),
        ("Heading 3", 11, DARK),
    ]:
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(13 if style_name != "Title" else 0)
        style.paragraph_format.space_after = Pt(5)
        style.paragraph_format.keep_with_next = True
        if style_name == "Title" and style._element.pPr is not None:
            border = style._element.pPr.find(qn("w:pBdr"))
            if border is not None:
                style._element.pPr.remove(border)
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = header.add_run("QMAPS  /  TECHNICAL REPORT")
    run.font.name = "Calibri"
    run.font.size = Pt(8)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(DARK)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = footer.add_run("QMaps project report     •     ")
    r.font.name = "Calibri"
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(MUTED)
    add_page_field(footer)


def add_h(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_p(doc, text="", bold_lead=None):
    p = doc.add_paragraph()
    if bold_lead and text.startswith(bold_lead):
        r = p.add_run(bold_lead)
        r.bold = True
        p.add_run(text[len(bold_lead):])
    else:
        p.add_run(text)
    return p


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    configure(doc)
    doc.core_properties.title = "QMaps Mathematical and Technical Project Report"
    doc.core_properties.subject = "Vehicle routing, quantum-inspired metaheuristics, dynamic traffic modeling, and benchmark evidence"
    doc.core_properties.author = "QMaps Project Team"
    doc.core_properties.keywords = "QMaps, VRPTW, QPSO, route optimization, benchmark, traffic"

    # Cover
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(84)
    r = p.add_run("QMAPS")
    r.bold = True
    r.font.name = "Calibri"
    r.font.size = Pt(13)
    r.font.color.rgb = RGBColor.from_string(GREEN)
    doc.add_paragraph("Mathematical and Technical Project Report", style="Title")
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(18)
    r = p.add_run("A judge-readable formulation of the route planning system, optimization methods, traffic model, and benchmark evidence")
    r.font.size = Pt(13)
    r.font.color.rgb = RGBColor.from_string(DARK)
    add_p(doc, "Prepared from the current QMaps repository, its saved benchmark CSV files, statistical outputs, and the implementation inspected on 28 September 2026.")
    add_p(doc, "Scope: the mathematical core, implementation choices, measured results, interpretation limits, and a reproducible path for stronger evaluation.")
    add_p(doc, "This report distinguishes implemented behavior from research conventions and future validation needs.")
    doc.add_page_break()

    # Contents
    add_h(doc, "Contents", 1)
    contents = [
        "1  Executive summary",
        "2  Project purpose and system boundary",
        "3  Vehicle routing with time windows",
        "4  Random keys and Prins split",
        "5  Optimization algorithms",
        "6  Dynamic traffic and realistic ETA",
        "7  Software architecture and operating flow",
        "8  Benchmark design and reproducibility",
        "9  Results from saved experiments",
        "10  Why QPSO underperforms on larger instances",
        "11  Evidence limits and recommended next experiments",
        "12  Glossary",
        "13  References",
        "Appendix A  Current implementation parameters",
        "Appendix B  Mathematical symbols",
    ]
    for line in contents:
        p = doc.add_paragraph(line)
        p.paragraph_format.space_after = Pt(5)
    doc.add_page_break()

    # 1
    add_h(doc, "1 Executive summary", 1)
    add_p(doc, "QMaps is a web-based logistics demonstration that accepts a depot, delivery stops, vehicle capacities, time windows, priorities, and traffic adjustments. A FastAPI service builds a route-planning instance and runs a selected optimizer. The frontend displays route assignments, street geometry, stop schedules, traffic annotations, and driver-facing directions.")
    add_p(doc, "The optimization core represents a delivery plan as a permutation of customers. Random-key vectors map continuous optimizer positions to permutations; a dynamic-programming split then divides that order into capacity-feasible vehicle routes and prefers a time-window-feasible split when one exists. The benchmark objective is total Euclidean route distance in the instance coordinate scale. In the live Navi Mumbai workflow, the backend also creates travel-time estimates and can include a soft high-priority-arrival term.")
    add_p(doc, "The repository contains six named methods: A*, PSO, QPSO, ACO, QACO, and the QA-QPSO hybrid. The hybrid spends an initial portion of its budget on QACO sequence construction, then warm-starts QPSO around that solution. “Quantum-inspired” means classical computation using probability-amplitude or QPSO-style update equations. The application does not run on quantum hardware.")
    add_p(doc, "The stored full suite contains 30 runs per algorithm on three selected instance sizes (25, 50, and 100 customers), with 540 rows in each of two historical CSV snapshots. In the newer historical snapshot, the hybrid has the lowest mean route-distance cost on the 25- and 50-customer cases, while ACO has the lowest mean on the 100-customer C101 case. These values are not directly comparable to standard Solomon best-known solutions because this project minimizes distance without the benchmark’s lexicographic minimize-vehicles-first objective, and the smaller RC cases are prefixes of larger files.")
    add_p(doc, "The saved historical PSO/QPSO comparison shows no reliable difference on RC101, and PSO has lower cost on RC201 and C101. A separate paired 30-seed rerun using the corrected canonical QPSO implementation still shows materially higher QPSO cost on RC201 and C101. The evidence supports a discrete-encoding mismatch as a plausible explanation, not a proof of causality: random-key decoding turns a continuous QPSO move into a rank permutation, so arithmetic attraction in key space is only indirectly related to route quality.")
    add_p(doc, "Traffic in the current application is modeled or manually supplied. The ETA combines a conservative 25 km/h urban-speed floor, a configured delay multiplier, the OSRM street route’s generic duration, service time, and early-arrival waiting. No live traffic feed, GPS-based incident detection, or guaranteed real-time arrival prediction is connected.")

    # 2
    add_h(doc, "2 Project purpose and system boundary", 1)
    add_h(doc, "2.1 Operational problem", 2)
    add_p(doc, "Given one depot and a set of customer deliveries, QMaps assigns each delivery to a vehicle, chooses a visit order for each vehicle, and schedules arrivals subject to vehicle capacity and customer time windows. The objective in the research benchmark is to reduce total route distance. In dispatch mode, travel-time estimates and optional priorities affect the schedule and can affect the optimizer’s soft cost.")
    add_p(doc, "The mathematical model below is a standard vehicle-flow formulation used to define the problem. The code does not call a mixed-integer programming solver. It searches over customer orders and applies a deterministic split decoder to create route sets.")
    add_h(doc, "2.2 Sets and parameters", 2)
    add_table(doc, ["Symbol", "Meaning"], [
        ("V = {0} ∪ C", "Nodes: depot 0 and customer set C = {1,…,n}."),
        ("K", "Available vehicles; vehicle k has capacity Qₖ."),
        ("dᵢⱼ", "Distance from i to j; Euclidean in Solomon runs."),
        ("τᵢⱼ", "Travel time from i to j; in benchmark files it follows the coordinate-time convention."),
        ("qᵢ", "Demand at customer i; depot demand is zero."),
        ("[aᵢ,bᵢ]", "Allowed service-start time window for customer i."),
        ("sᵢ", "Service duration at customer i."),
        ("M", "A sufficiently large constant for conditional time constraints."),
        ("xᵢⱼₖ", "Binary variable: vehicle k travels directly from node i to j."),
        ("zᵢₖ", "Binary variable: vehicle k serves customer i."),
        ("Tᵢₖ", "Service-start time at customer i when assigned to vehicle k."),
    ], widths=[1.55, 4.95], font_size=9.0)

    # 3
    add_h(doc, "3 Vehicle routing with time windows", 1)
    add_h(doc, "3.1 Distance and cost", 2)
    add_p(doc, "For Solomon coordinates (xᵢ,yᵢ), the loader forms a complete distance matrix using unrounded Euclidean distance. The input coordinates are benchmark units, so the resulting total is a coordinate-distance cost, not automatically kilometers.")
    add_equation(doc, "distance", 1)
    add_p(doc, "Let K be the vehicle set and A the allowed directed arcs between distinct nodes. The standard distance objective is:")
    add_equation(doc, "objective", 2)
    add_p(doc, "The benchmark evaluator sums every route’s depot-to-customer, customer-to-customer, and customer-to-depot edges. The benchmark has no priority weights, so it reduces to this distance sum.")
    add_h(doc, "3.2 Service and assignment constraints", 2)
    add_p(doc, "Every customer must be included exactly once. A vehicle that serves a customer must enter and leave that customer once, which links assignment to route flow.")
    add_equation(doc, "visit_once", 3)
    add_equation(doc, "flow", 4)
    add_p(doc, "For each vehicle, depot departure and depot return are balanced. A separate vehicle-use variable uₖ can identify whether a route is active.")
    add_equation(doc, "depot", 5)
    add_p(doc, "The total package demand assigned to a vehicle cannot exceed its capacity.")
    add_equation(doc, "capacity", 6)
    add_p(doc, "The route, assignment, and vehicle-use decisions are binary; service-start times are nonnegative.")
    add_equation(doc, "domains", 7)
    add_p(doc, "The flow equations need subtour elimination in a direct arc-based optimization model. QMaps’ route decoder avoids detached customer cycles by emitting complete sequences that are split into depot-rooted routes.")
    add_h(doc, "3.3 Time-window constraints", 2)
    add_p(doc, "Let Tᵢₖ denote the time service begins at i. If k travels from i to j, service at j cannot begin before travel and service at i have finished. Big-M relaxes the constraint when that arc is not selected.")
    add_equation(doc, "time_propagation", 8)
    add_p(doc, "Time-window bounds apply to an assigned customer. The model allows waiting when a vehicle arrives before a window opens.")
    add_equation(doc, "time_bounds", 9)
    add_equation(doc, "service_clock", 10)
    add_equation(doc, "wait_depart", 11)
    add_p(doc, "Feasibility requires service to start no later than bᵢ. In the current route checker, early arrivals are delayed to aᵢ, and the service-start time is checked against bᵢ. The return to the depot is checked against the depot’s due time.")
    add_equation(doc, "return_window", 12)
    add_h(doc, "3.4 Live priority cost", 2)
    add_p(doc, "If the live request attaches priority weights, the route evaluator retains distance and adds a soft penalty proportional to each weighted service-start clock in hours. The default coefficient is 0.5. This component is absent from the Solomon benchmark runs.")
    add_equation(doc, "priority_objective", 13)
    add_p(doc, "Priority is therefore a soft preference. It does not override capacity or a feasible time window, although the optimizer ranks candidate solutions by the returned numeric cost and stores feasibility separately.")

    # 4
    add_h(doc, "4 Random keys and Prins split", 1)
    add_h(doc, "4.1 Continuous position to customer order", 2)
    add_p(doc, "PSO and QPSO operate on real-valued key vectors x ∈ ℝⁿ. Sorting the keys produces a permutation π of customers. The decoder consumes rank only: adding a constant or applying a strictly increasing transformation leaves the order unchanged, except for ties.")
    add_equation(doc, "keys", 14)
    add_p(doc, "ACO and QACO directly construct a sequence and convert its ranks back into keys. A* also produces an order that is converted to this common representation before route evaluation. The common decoder makes route evaluation consistent, but it does not make the optimizers’ search moves equivalent.")
    add_h(doc, "4.2 Feasible route segments", 2)
    add_p(doc, "For a permutation π = (s₁,…,sₙ), the split procedure considers contiguous subsequences. A segment from sequence position i through j represents one vehicle route: depot → sᵢ → … → sⱼ → depot.")
    add_equation(doc, "segment_distance", 15)
    add_equation(doc, "segment_capacity", 16)
    add_p(doc, "A segment is also time-window-feasible when the forward schedule, with early waiting, reaches every customer by its due time. The loader’s split logic extends candidate segments incrementally and stops extending once capacity or a due-time constraint fails.")
    add_h(doc, "4.3 Dynamic-programming split", 2)
    add_p(doc, "The unrestricted split computes the least distance over all feasible segmentations of the fixed sequence. Fⱼ is the least cost for the first j sequence positions; each transition appends one feasible segment.")
    add_equation(doc, "split_dp", 17)
    add_p(doc, "When the live request provides a fleet limit, the implementation uses a route-count state Fₖⱼ and then selects the least-cost solution among feasible route counts up to that limit.")
    add_equation(doc, "split_fleet", 18)
    add_p(doc, "The code tries time-window-feasible segments first. If no full split is found, it retries using capacity-feasible segments alone. In that fallback, the returned route can be capacity-feasible but fail time windows; the feasibility flag is checked by the evaluator. Saved full-suite CSV rows report all 30 runs feasible for every algorithm and instance.")
    add_p(doc, "The implementation minimizes distance over route counts subject to a fleet limit. It does not add a fixed cost per vehicle or lexicographically minimize vehicle count first. This distinction matters when comparing against benchmark solutions whose primary objective is fleet size.")

    # 5
    add_h(doc, "5 Optimization algorithms", 1)
    add_h(doc, "5.1 Classical particle swarm optimization", 2)
    add_p(doc, "PSO stores a position xᵢ and velocity vᵢ for every particle. A particle is attracted toward its personal best pᵢ and the swarm’s global best g. Independent random values r₁ and r₂ are sampled across particles and dimensions.")
    add_equation(doc, "pso_velocity", 19)
    add_equation(doc, "pso_position", 20)
    add_p(doc, "Current PSO source defaults are 30 particles, inertia ω = 0.7, and acceleration coefficients c₁ = c₂ = 1.5. Positions are clipped into [0,1] before sorting. The bounded box does not constrain the route order to be valid or invalid; any finite key vector still decodes to a permutation.")
    add_h(doc, "5.2 Quantum-behaved particle swarm optimization", 2)
    add_p(doc, "QPSO removes the velocity state. Each particle samples a local attractor between its personal best and the global best, while the population mean-best guides the scale of its logarithmic sampling step.")
    add_equation(doc, "qpso_attractor", 21)
    add_equation(doc, "qpso_mbest", 22)
    add_p(doc, "The current source uses a linearly contracting expansion coefficient from 1.0 to approximately 0.5 over the configured iteration count.")
    add_equation(doc, "qpso_beta", 23)
    add_p(doc, "The QPSO position update is a direct stochastic sample around the local attractor. The sign is chosen randomly. There is no velocity update.")
    add_equation(doc, "qpso_update", 24)
    add_p(doc, "The implementation starts independent particles in [0,1] for standalone QPSO. Keys are not clipped after the update; non-finite values are repaired before argsort. The constructor accepts beta_initial for compatibility and hybrid callers, but the current update computes β from iteration/max_iter and does not read beta_initial. Consequently, changing beta_initial alone does not alter the standalone QPSO contraction schedule.")
    add_h(doc, "5.3 Ant colony optimization", 2)
    add_p(doc, "ACO constructs an order step by step. At node i, it chooses an unvisited customer j according to pheromone τᵢⱼ and inverse-distance visibility ηᵢⱼ. Probabilities are normalized over currently unvisited candidates.")
    add_equation(doc, "aco_eta", 25)
    add_equation(doc, "aco_transition", 26)
    add_p(doc, "After an iteration, trails evaporate and each ant deposits an amount inversely proportional to its route cost on the directed edges in its constructed permutation.")
    add_equation(doc, "aco_update", 27)
    add_p(doc, "Current ACO source defaults are 30 ants, α = 1, β = 3, evaporation ρ = 0.5, and Q = 1. The project context note lists a different ACO profile (20 ants, β = 5, ρ = 0.1). The full-run CSV does not store a configuration snapshot, so the note and the saved historical values must not be treated as proof of which exact parameter profile generated each old file.")
    add_h(doc, "5.4 Quantum-inspired ant colony optimization", 2)
    add_p(doc, "QACO stores one rotation angle θᵢⱼ per directed edge. Its quantum-inspired state is represented classically by two amplitudes. The probability of observing state |1⟩ is sin²θ, and that probability is combined with the same inverse-distance heuristic used by ACO.")
    add_equation(doc, "qaco_state", 28)
    add_equation(doc, "qaco_measure", 29)
    add_p(doc, "At each iteration, the current best ant has cost Lbest. Other ants receive a nonnegative quality gap ΔEₖ. The code uses a temperature floor of 0.05 and a capped rotation; edges in the iteration-best sequence rotate toward higher selection probability, while edges in another ant’s sequence that are absent from the iteration best receive a weaker opposing rotation.")
    add_equation(doc, "qaco_temp", 30)
    add_equation(doc, "qaco_rotation", 31)
    add_equation(doc, "qaco_theta", 32)
    add_p(doc, "Current QACO defaults are 20 ants, α = 1, β = 5, and θ₀ = π/4. This is the project’s quantum-inspired rotation-angle implementation. The exact angle update is implementation-specific; do not claim an exact reproduction of a named paper without comparing its parameters and update rule. This remains a classical QACO variant, not execution on a quantum processor.")
    add_h(doc, "5.5 QA-QPSO hybrid", 2)
    add_p(doc, "The hybrid first runs QACO for 40% of the configured iteration budget. It sends QACO’s best key vector and cost to QPSO, which initializes one particle at that point and initializes the remaining particles by adding independent Gaussian noise with standard deviation 0.1. The QPSO phase receives a different seed.")
    add_equation(doc, "hybrid_budget", 33)
    add_p(doc, "For more than 50 customers, the hybrid increases the QPSO population by 10. It also passes a larger beta_initial value, but the current QPSO update does not consume that parameter; the particle-count change does take effect. Runtime is divided using a 40% QACO allocation and the remaining measured time for QPSO.")
    add_p(doc, "The hybrid’s empirical performance belongs to this exact staged implementation and budget. Its improvement cannot be attributed to QPSO in isolation because the hybrid includes QACO initialization and spends part of its total budget in each method.")
    add_h(doc, "5.6 A* search baseline", 2)
    add_p(doc, "The code named A* searches bitmask states over customer orders under a time limit. It first evaluates deterministic and randomized candidate orders, then expands states using f = g + h. Completed orders are passed through the same split decoder.")
    add_p(doc, "The search-state path cost g is the sum of consecutive edges through the single customer sequence, whereas the reported final VRPTW objective is the split multi-route distance. Therefore the A* queue is not optimizing precisely the same cost that is reported after split. Treat these A* values as a project reference point, not as proof of an A* optimum or a directly equivalent metaheuristic comparison.")

    # 6
    add_h(doc, "6 Dynamic traffic and realistic ETA", 1)
    add_h(doc, "6.1 Static benchmark time and live dispatch time", 2)
    add_p(doc, "The Solomon benchmark uses coordinates, demands, time windows, and service times. In the benchmark evaluator, distance and travel-time matrices follow the instance coordinate-time convention. The Navi Mumbai API builds a separate physical-distance matrix and initializes the travel-time matrix from an assumed 25 km/h urban speed. Scenario multipliers then alter selected pairwise links.")
    add_h(doc, "6.2 Congestion and incident adjustments", 2)
    add_p(doc, "For an ordinary modeled delay δᵢⱼ, the adjusted pairwise time is multiplied by 1 + δᵢⱼ. The rush-hour scenario applies a 45% multiplier to the selected north-corridor pairs. The accident scenario applies a 2.2 multiplier, representing a 120% increase, on its selected pair. A manually entered closure assigns a large finite cost so the solver strongly avoids the pair while retaining a plan if no alternative exists.")
    add_equation(doc, "traffic_adjust", 34)
    add_equation(doc, "closure", 35)
    add_p(doc, "The legacy research event simulator supports congestion and accident multipliers and can mark a closed matrix edge as infinite. The current manual Navi closure uses a finite penalty; it is therefore a strongly discouraged pairwise connection rather than a street-level hard exclusion. These are scenario models and do not come from live sensors.")
    add_h(doc, "6.3 Street geometry and ETA", 2)
    add_p(doc, "After the optimizer chooses the visit sequence, the frontend can request road geometry and turn steps from the configured OSRM service. For each leg it compares the generic routing duration with a city-speed floor based on the road distance. It then applies the backend’s configured traffic multiplier.")
    add_equation(doc, "urban_speed", 36)
    add_equation(doc, "street_eta", 37)
    add_p(doc, "The route-level ETA adds modeled street-driving time, service time, and early-arrival waiting. Stop arrival and departure clocks are propagated in sequence.")
    add_equation(doc, "route_eta", 38)
    add_p(doc, "This model avoids implausibly fast default profile estimates for short urban delivery legs, but 25 km/h is a configurable engineering assumption, not a calibration against a Navi Mumbai probe-vehicle dataset. The application’s own terms describe travel-time and congestion as estimates and state that a live traffic feed is not connected.")
    add_h(doc, "6.4 What dynamic rerouting currently means", 2)
    add_p(doc, "An incident or manual corridor edit changes the modeled pairwise travel-time matrix and the optimizer runs again. The selected visit order is then mapped to street geometry. This is useful for a controlled demonstration of route recovery, but it is not yet traffic sensing over an instrumented street graph. A pair of delivery locations is the unit of adjustment in the demo; a real street closure may affect only a subsegment of the roads between them.")
    add_p(doc, "A production-grade real-time system would need an approved live traffic provider or operational telemetry, time-dependent road-edge costs, incident confidence and expiry, GPS map matching, route-update delivery to drivers, and replayable event logs. Those capabilities are not claimed as currently implemented.")

    # 7
    add_h(doc, "7 Software architecture and operating flow", 1)
    add_p(doc, "The implementation separates user interaction, route optimization, and street presentation:")
    add_bullet(doc, "Next.js frontend: collects locations, time windows, priorities, vehicle capacities, and modeled traffic settings; displays benchmarks, dispatch results, driver instructions, and the interactive route/city visual.")
    add_bullet(doc, "FastAPI backend: validates request inputs, constructs distance and travel-time matrices, instantiates the selected optimizer, and returns route assignments, feasibility, costs, schedules, and optimization metadata.")
    add_bullet(doc, "Optimizer layer: PSO/QPSO/ACO/QACO/QA-QPSO/A* evaluate customer orders through the shared decoder and split. The same evaluator reports cost, route list, convergence history, run time, iterations-to-best, and feasibility.")
    add_bullet(doc, "Street routing layer: configured OSRM supplies road geometry, generic road duration, and turn-by-turn steps for the ordered stops. The frontend recalculates displayed distance and ETA when all route legs are mapped.")
    add_p(doc, "The product flow is: location and fleet inputs → route-order search → capacity/time-window split → feasible route assignments → street geometry and ETA decoration → dispatch and driver view. The visual city and moving vans are presentation of these route results; the solver itself works on a coordinate-derived complete graph and does not simulate a vehicle moving through a live traffic network.")
    add_h(doc, "7.1 Operational state and data boundary", 2)
    add_p(doc, "The current dispatch demo stores shared state in API process memory. The project-readiness notes report that the driver selector is not authentication and the API does not enforce per-driver authorization. These are prototype boundaries, not optimization features. Before a real-company pilot, the deployment needs authenticated roles, server-side access control, persistent audited state if required, a retention/deletion policy, and production map/routing services.")

    # 8
    add_h(doc, "8 Benchmark design and reproducibility", 1)
    add_h(doc, "8.1 Data and run budget", 2)
    add_p(doc, "The runner selects RC101 with 25 customers, RC201 with 50 customers, and C101 with 100 customers. The supplied instance files are read in customer-number order, and the runner takes the first n customers requested for each run. RC101 and RC201 are therefore reduced-size prefixes in this repository, not full 100-customer instances. The Solomon family is a standard VRPTW benchmark family [1], but the selected prefixes and the project’s objective must be reported with the results.")
    add_table(doc, ["Experiment component", "Repository setting"], [
        ("Instances", "RC101 prefix (25), RC201 prefix (50), C101 (100)"),
        ("Algorithms", "A*, PSO, QPSO, ACO, QACO, QA-QPSO"),
        ("Runs", "30 per algorithm and instance; seed = run index 0–29"),
        ("Budget", "At most 300 iterations or 5 seconds per standalone run"),
        ("Saved fields", "Cost, runtime, iterations to best, feasibility, convergence length and curve"),
        ("Full-suite count", "3 instances × 6 algorithms × 30 runs = 540 rows per CSV"),
        ("Targeted QPSO rerun", "RC201 and C101 × PSO/QPSO × 30 matched seeds = 120 rows"),
    ], widths=[1.65, 4.85], font_size=9.0)
    add_p(doc, "The main runner fixes each algorithm’s random seed to the run index. Its CSV contains repeated seed identifiers but does not record the exact constructor parameters, Git commit, Python/NumPy versions, or file hashes. Historical results are reproducible only to the extent that the source snapshot and environment used to produce them can be recovered.")
    add_h(doc, "8.2 Descriptive statistics", 2)
    add_p(doc, "For R runs, the report uses arithmetic mean route cost and sample standard deviation. Lower cost is preferred. Feasibility is reported separately.")
    add_equation(doc, "mean", 39)
    add_equation(doc, "sample_sd", 40)
    add_h(doc, "8.3 Pairwise and multi-algorithm tests", 2)
    add_p(doc, "The saved analysis uses a Shapiro–Wilk check to inspect normality, Wilcoxon signed-rank tests for paired two-algorithm comparisons, and Friedman tests for six algorithms ranked across matched run blocks. This follows established nonparametric comparison practice for stochastic algorithms [8, 9]. A Nemenyi critical difference can be used for post-hoc average-rank comparisons.")
    add_equation(doc, "shapiro", 41)
    add_equation(doc, "paired_diff", 42)
    add_equation(doc, "wilcoxon", 43)
    add_equation(doc, "friedman", 44)
    add_equation(doc, "nemenyi", 45)
    add_p(doc, "The repository’s signed-rank utility computes an exact two-sided rank-sum null probability for the paired differences. Zero differences are removed from the signed-rank calculation. The saved pairwise analysis reports pooled-standard-deviation Cohen’s d:")
    add_equation(doc, "pooled_sd", 46)
    add_equation(doc, "cohens_d", 47)
    add_p(doc, "For a lower-cost comparison, negative d under the convention d = (QPSO − PSO)/sₚ favors QPSO; positive d favors PSO. In this report, the formula is written as the difference of the two means divided by the pooled standard deviation. For paired experiments, a paired effect size such as d_z = mean(dᵣ)/sd(dᵣ) can also be reported, but it is not the effect-size definition stored in the project’s current correction-run summary.")
    add_p(doc, "For paired data, a complementary standardized difference is d_z = mean(d_r) / sd(d_r).")
    add_equation(doc, "paired_dz", 48)
    add_h(doc, "8.4 Multiplicity and scope", 2)
    add_p(doc, "The archived per-instance Wilcoxon p-values and pairwise claims are raw and are not adjusted for the many algorithm-by-instance comparisons. The Friedman tests are per instance, not one pooled test over all three problem families. The targeted QPSO correction rerun covers only RC201 and C101 and is a separate experiment from the historical six-algorithm suite.")

    # 9
    add_h(doc, "9 Results from saved experiments", 1)
    add_h(doc, "9.1 Full six-algorithm suite", 2)
    add_p(doc, "Table 1 uses the newer historical full-run file, results/benchmark_full_20260925_160939.csv. Each cell is mean ± sample standard deviation across 30 runs, in coordinate-distance cost units. Every saved row in that file is marked feasible. The two historical full-run CSV files are not identical; their means differ for several algorithms. They are kept separate and are not pooled.")
    add_table(doc, ["Algorithm", "RC101 25", "RC201 50", "C101 100"], [
        ("A*", "901.24 ± 0.00", "1737.87 ± 0.00", "2378.58 ± 0.00"),
        ("PSO", "977.98 ± 43.80", "2510.13 ± 65.16", "4319.48 ± 77.82"),
        ("QPSO", "976.26 ± 36.21", "2564.39 ± 67.08", "4366.66 ± 49.91"),
        ("ACO", "696.20 ± 32.82", "1447.93 ± 43.11", "1824.99 ± 152.43"),
        ("QACO", "661.11 ± 23.62", "1406.17 ± 35.31", "1987.36 ± 115.90"),
        ("QA-QPSO", "557.54 ± 29.84", "1233.69 ± 54.72", "1897.01 ± 121.47"),
    ], widths=[1.1, 1.8, 1.8, 1.8], font_size=8.5)
    add_p(doc, "The A* rows have zero sample standard deviation in this file. More importantly, the A* implementation’s search-state path cost and the split route objective are not identical, so A* is not a like-for-like benchmark comparator. Do not interpret a lower or higher A* table value as an optimality result.")
    add_h(doc, "9.2 Historical PSO and QPSO comparison", 2)
    add_p(doc, "The saved statistical summary for the newer historical CSV reports the following paired comparisons. P-values are unadjusted; d is pooled-standard-deviation Cohen’s d using QPSO minus PSO.")
    add_table(doc, ["Instance", "PSO mean", "QPSO mean", "Wilcoxon p", "Cohen d", "Interpretation"], [
        ("RC101", "977.98", "976.26", "0.7922", "−0.043", "No detectable difference; negligible effect"),
        ("RC201", "2510.13", "2564.39", "0.0006", "+0.821", "PSO lower cost; large effect"),
        ("C101", "4319.48", "4366.66", "0.0234", "+0.722", "PSO lower cost; medium effect"),
    ], widths=[0.78, 0.92, 0.92, 0.95, 0.75, 2.1], font_size=8.1)
    add_p(doc, "The per-instance Friedman omnibus tests in the saved output reject equal algorithm ranks on all three cases (RC101 p = 2.85 × 10⁻²⁹, RC201 p = 2.69 × 10⁻²⁹, C101 p = 7.11 × 10⁻²⁸). This only establishes that at least some algorithms differ on each instance; it does not make every pairwise comparison significant.")
    add_h(doc, "9.3 Matched QPSO correction rerun", 2)
    add_p(doc, "The separate file results/qpso_correction_20260928_002809.csv labels QPSO implementation canonical-qpso-unbounded-keys-v2. It contains 30 matched seeds for PSO and QPSO on RC201 and C101 under a 300-iteration/5-second budget. The project’s exact paired Wilcoxon utility was applied to these saved costs for this report.")
    add_table(doc, ["Instance", "PSO mean", "QPSO mean", "QPSO cost excess", "Wilcoxon p", "Cohen d"], [
        ("RC201", "1896.38", "2424.36", "+27.84%", "6.15 × 10⁻⁸", "+2.75"),
        ("C101", "3357.94", "4405.49", "+31.20%", "1.86 × 10⁻⁹", "+7.77"),
    ], widths=[0.82, 1.05, 1.05, 1.12, 1.25, 1.0], font_size=8.3)
    add_p(doc, "All 120 rows are marked feasible. The unadjusted p-values remain below 0.05 after a two-comparison Bonferroni threshold of 0.025. This targeted rerun is strong evidence that QPSO’s current corrected implementation still performs worse than PSO on these two saved cases; it does not establish performance on RC101 or on other instances.")
    add_p(doc, "The corrected rerun’s PSO means differ substantially from the historical suite. The studies are separate snapshots and should not be merged or compared as if only QPSO changed. A future publication-grade rerun should pin one source commit, record all algorithm parameters and data hashes, and execute every algorithm from that same snapshot.")
    add_h(doc, "9.4 Reading the results responsibly", 2)
    add_p(doc, "The full-suite table supports a narrow statement: on the archived selected instances and the project’s cost definition, the hybrid had the lowest mean on RC101 and RC201, while ACO had the lowest mean on C101. It does not support a universal statement that the hybrid or any quantum-inspired method always wins. Benchmark best-known comparisons require the same customer set, capacity/fleet conditions, distance precision, and objective ordering.")
    add_p(doc, "SINTEF’s Solomon VRPTW reference uses a hierarchical objective: first minimize vehicle count, then minimize total distance [10]. QMaps’ current split minimizes distance among routes within the available fleet bound; it does not enforce the same lexicographic objective. Therefore the values in Table 1 should be described as internal comparative costs, not as Solomon best-known gaps.")

    # 10
    add_h(doc, "10 Why QPSO underperforms on larger instances", 1)
    add_h(doc, "10.1 What the data says", 2)
    add_p(doc, "The historical 30-run comparison shows QPSO statistically indistinguishable from PSO on the 25-customer RC101 prefix, then worse mean cost on the 50-customer RC201 prefix and 100-customer C101 instance. The corrected matched rerun repeats the direction on the two larger instances. This pattern is consistent with a representation and scaling problem, but a benchmark comparison alone cannot identify the cause.")
    add_h(doc, "10.2 Continuous attraction meets a permutation decoder", 2)
    add_p(doc, "Random-key encoding maps an n-dimensional continuous point to a discrete order only through pairwise key rankings. The decoded solution changes when keys cross. Within a region where all pairwise rankings stay fixed, many different key vectors represent the same permutation. The objective seen by QPSO is consequently piecewise constant or discontinuous across ranking boundaries rather than a smooth function of Euclidean key-space distance.")
    add_p(doc, "QPSO computes local attractors and mbest using arithmetic averages of numeric keys. Yet two vectors that are numerically close can encode different meaningful adjacency patterns, and two distant vectors can encode the same order. Arithmetic averaging in key coordinates therefore does not directly average routes, customer adjacencies, or split boundaries.")
    add_h(doc, "10.3 Why the gap can grow with n", 2)
    add_bullet(doc, "The number of key coordinates grows with customer count, increasing the chance that a sampled update changes many relative ranks at once.")
    add_bullet(doc, "A small numeric move can leave every key ordering unchanged, so the route evaluator returns the same discrete plan even though the particle moved.")
    add_bullet(doc, "A large move can reorder many customers together, producing a broad route change that is difficult to refine with the continuous attractor.")
    add_bullet(doc, "The Prins split is deterministic for a given order. It can optimize segment boundaries for that order, but QPSO changes vehicle composition only indirectly by changing the permutation.")
    add_bullet(doc, "The canonical QPSO contraction parameter is scheduled by iteration, but the beta_initial argument is currently unused. Hybrid code that passes a larger beta_initial for n > 50 does not actually increase QPSO’s exploration radius.")
    add_h(doc, "10.4 What was corrected and what remains", 2)
    add_p(doc, "The current QPSO code uses the no-velocity quantum-behaved update, independent initial samples, an updated global best, and unbounded finite random keys. These are meaningful implementation corrections. The rerun demonstrates that correcting those mechanics does not by itself solve the mismatch between continuous key-space dynamics and a rank-decoded routing objective.")
    add_p(doc, "The evidence does not show that QPSO is intrinsically inferior to PSO. It shows that this QPSO configuration plus this encoding/decoder and short run budget is inferior on the two tested larger cases. A well-designed permutation-aware QPSO hybrid could behave differently and needs a separately registered experiment.")

    # 11
    add_h(doc, "11 Evidence limits and recommended next experiments", 1)
    add_h(doc, "11.1 Limitations to state to judges", 2)
    for item in [
        "No live traffic provider, real-time incident detector, or live vehicle GPS stream is connected. Current traffic is selected from scenarios or entered as a modeled adjustment.",
        "Optimizer edges are based on coordinate-derived pairwise distances and times. OSRM street geometry is attached after stop order selection; the metaheuristic does not optimize directly on a time-dependent road graph.",
        "The 25 km/h urban-speed floor is a transparent model parameter, not empirically calibrated or a probabilistic ETA interval.",
        "RC101 and RC201 are reduced-size prefixes in the benchmark runner. Their results are not identical to runs on the full canonical 100-customer files.",
        "The objective does not use the standard Solomon/SINTEF lexicographic fleet-count-first objective, so internal mean costs are not best-known-solution gaps.",
        "Historical CSV files do not include code commit, complete parameter snapshot, library versions, or data hashes. Two full-suite CSV snapshots differ.",
        "The A* path-expansion cost and post-split route-distance cost differ, limiting direct comparison.",
        "The saved benchmark comparison uses raw pairwise p-values without an across-all-comparisons multiplicity adjustment. The report labels them unadjusted.",
        "The matched QPSO correction rerun covers only RC201 and C101. No corrected 30-seed RC101 rerun is present.",
    ]:
        add_bullet(doc, item)
    add_h(doc, "11.2 Recommended experimental sequence", 2)
    add_table(doc, ["Step", "Action", "Reason"], [
        ("1", "Pin a Git commit, environment versions, data checksums, and constructor parameters in every CSV row or a linked manifest.", "Makes each benchmark result auditable and repeatable."),
        ("2", "Align all methods to the same Solomon customer set and objective; report fleet count first, then distance, or explicitly define a different objective.", "Prevents a method from appearing better by using extra vehicles or a different cost."),
        ("3", "Run all six algorithms on all three instances with the same 30 seeds and the same wall-clock/iteration policy.", "Keeps the comparison paired and complete."),
        ("4", "Add a permutation-aware QPSO neighborhood: swap/insert moves, rank-space distance, or an order-preserving map; preserve the canonical QPSO baseline separately.", "Tests the discrete-encoding hypothesis without changing the baseline retrospectively."),
        ("5", "If beta_initial is intended to matter, wire it into a documented schedule, then compare with the current fixed schedule as a separate ablation.", "Resolves the unused-parameter mismatch."),
        ("6", "Record best, mean, median, standard deviation, feasibility, vehicle count, wall time, convergence curves, paired Wilcoxon, an effect size suited to paired data, and multiplicity-adjusted post-hoc results.", "Shows quality, reliability, runtime, and uncertainty."),
        ("7", "Calibrate ETA against observed trips and compare predicted versus actual travel times by road class and time of day.", "Turns the 25 km/h floor from an assumption into a measured model."),
        ("8", "Model live road segments with provider-supplied or telemetry-derived time-dependent edge costs, then replay incidents with confidence and expiry.", "Moves dynamic rerouting toward an operational road-network model."),
    ], widths=[0.48, 3.45, 2.57], font_size=8.0)
    add_h(doc, "11.3 Recommended judge-facing claim", 2)
    add_p(doc, "A defensible summary is: “QMaps combines a VRPTW route-order search with capacity/time-window splitting, a dispatch interface, and scenario-based congestion rerouting. In the saved 30-run internal suite, the QA-QPSO hybrid has the lowest mean cost on the RC101 and RC201 subsets, while ACO is lowest on C101. QPSO alone underperforms PSO on the larger tested cases, including a separate corrected 30-seed rerun. Traffic inputs and ETAs are modeled rather than live.”")
    add_p(doc, "Avoid saying that a quantum method universally outperforms classical methods, that benchmark values match published best-known Solomon solutions, or that QMaps detects real-time accidents. Those claims are not supported by the inspected implementation and saved artifacts.")

    # 12
    add_h(doc, "12 Glossary", 1)
    add_table(doc, ["Term", "Definition in this report"], [
        ("VRP", "Vehicle Routing Problem: assigning customers to routes and ordering visits."),
        ("VRPTW", "Vehicle Routing Problem with Time Windows: service at each customer must begin within an allowed interval."),
        ("Random key", "A real number associated with each customer; argsort yields a customer permutation."),
        ("Prins split", "Dynamic-programming procedure that partitions a fixed customer order into routes."),
        ("Personal best", "Best decoded solution previously found by one PSO/QPSO particle."),
        ("Global best", "Best decoded solution found by the swarm so far."),
        ("mbest", "Coordinate-wise mean of all particles’ personal-best vectors in QPSO."),
        ("Feasible", "Plan satisfies the capacity/time-window checks used by the current evaluator."),
        ("Modeled congestion", "A user- or scenario-supplied multiplier applied to a pairwise travel-time estimate."),
        ("OSRM", "Open Source Routing Machine; configured service used for generic road routes, geometry, and maneuver steps."),
        ("Cohen’s d", "Standardized mean difference; the project currently uses a pooled-standard-deviation denominator."),
        ("Matched seed", "A run index reused for each algorithm so results can be paired by experimental block."),
    ], widths=[1.45, 5.05], font_size=8.8)

    # 13
    add_h(doc, "13 References", 1)
    add_reference(doc, 1, "Solomon, M. M. (1987). Algorithms for the Vehicle Routing and Scheduling Problems with Time Window Constraints. Operations Research, 35(2), 254–265. doi:10.1287/opre.35.2.254.", "INFORMS record", "https://doi.org/10.1287/opre.35.2.254")
    add_reference(doc, 2, "Bean, J. C. (1994). Genetic Algorithms and Random Keys for Sequencing and Optimization. ORSA Journal on Computing, 6(2), 154–160. doi:10.1287/ijoc.6.2.154.", "INFORMS record", "https://doi.org/10.1287/ijoc.6.2.154")
    add_reference(doc, 3, "Prins, C. (2004). A simple and effective evolutionary algorithm for the vehicle routing problem. Computers & Operations Research, 31(12), 1985–2002. doi:10.1016/S0305-0548(03)00158-8.", "Publisher DOI", "https://doi.org/10.1016/S0305-0548(03)00158-8")
    add_reference(doc, 4, "Kennedy, J., & Eberhart, R. (1995). Particle swarm optimization. Proceedings of the IEEE International Conference on Neural Networks, 4, 1942–1948. doi:10.1109/ICNN.1995.488968.", "IEEE DOI", "https://doi.org/10.1109/ICNN.1995.488968")
    add_reference(doc, 5, "Sun, J., Xu, W., & Feng, B. (2004). A global search strategy of quantum-behaved particle swarm optimization. IEEE Conference on Cybernetics and Intelligent Systems, 111–116. doi:10.1109/ICCIS.2004.1460396.", "IEEE record", "https://ieeexplore.ieee.org/document/1460396/")
    add_reference(doc, 6, "Hart, P. E., Nilsson, N. J., & Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. IEEE Transactions on Systems Science and Cybernetics, 4(2), 100–107. doi:10.1109/TSSC.1968.300136.", "IEEE DOI", "https://doi.org/10.1109/TSSC.1968.300136")
    add_reference(doc, 7, "Dorigo, M., Maniezzo, V., & Colorni, A. (1996). Ant System: Optimization by a colony of cooperating agents. IEEE Transactions on Systems, Man, and Cybernetics, Part B, 26(1), 29–41.", "Publisher record", "https://doi.org/10.1109/3477.484436")
    add_reference(doc, 8, "Demšar, J. (2006). Statistical Comparisons of Classifiers over Multiple Data Sets. Journal of Machine Learning Research, 7, 1–30.", "JMLR article", "https://www.jmlr.org/papers/v7/demsar06a.html")
    add_reference(doc, 9, "Derrac, J., García, S., Molina, D., & Herrera, F. (2011). A practical tutorial on the use of nonparametric statistical tests as a methodology for comparing evolutionary and swarm intelligence algorithms. Swarm and Evolutionary Computation, 1(1), 3–18. doi:10.1016/j.swevo.2011.02.002.", "Publisher DOI", "https://doi.org/10.1016/j.swevo.2011.02.002")
    add_reference(doc, 10, "SINTEF Applied Mathematics. Solomon 100-customer VRPTW instances and best-known solutions. The page states a hierarchical objective of first minimizing vehicles and then distance.", "Benchmark reference", "https://www.sintef.no/projectweb/top/vrptw/100-customers/")

    # Appendix A
    add_h(doc, "Appendix A Current implementation parameters", 1)
    add_p(doc, "This table lists current class defaults inspected in the repository. It does not reconstruct the exact parameters used in historical CSV snapshots because those files do not serialize complete configurations.")
    add_table(doc, ["Method", "Current source defaults and behavior"], [
        ("PSO", "30 particles; ω = 0.7; c₁ = 1.5; c₂ = 1.5; keys clipped to [0,1]."),
        ("QPSO", "30 particles; β(t) = 1 − 0.5t/T; no velocity; finite keys remain unbounded; beta_initial is stored but unused in the update."),
        ("ACO", "30 ants; α = 1; β = 3; ρ = 0.5; Q = 1."),
        ("QACO", "20 ants; α = 1; β = 5; θ₀ = π/4; probability is sin²θ times distance heuristic."),
        ("QA-QPSO", "QACO uses 40% of configured iterations; QPSO uses remainder; QPSO population increases by 10 for n > 50; warm start around QACO best."),
        ("A*", "Bitmask customer-order search with a 5-second default time limit; queue-state path cost does not equal post-split route cost."),
    ], widths=[1.15, 5.35], font_size=8.8)
    add_p(doc, "Parameter differences between current defaults and AGENTS.md project notes, particularly ACO, should be reconciled before the next formal run. The report favors code evidence over stale intended configuration.")

    # Appendix B
    add_h(doc, "Appendix B Mathematical symbols", 1)
    add_table(doc, ["Symbol", "Meaning"], [
        ("i, j, k", "Node, node, and vehicle indices."),
        ("C, V, K", "Customer set, all nodes including depot, and available vehicles."),
        ("dᵢⱼ, τᵢⱼ", "Distance and travel time from i to j."),
        ("qᵢ, Qₖ", "Customer demand and vehicle capacity."),
        ("aᵢ, bᵢ, sᵢ", "Opening time, closing time, and service duration."),
        ("π, sᵣ", "Customer permutation and customer at sequence position r."),
        ("xᵢⱼₖ, zᵢₖ, uₖ", "Arc choice, customer-to-vehicle assignment, and vehicle-use indicator."),
        ("Tᵢₖ, Aᵢ, Sᵢ, Wᵢ, Dᵢ", "Service time, arrival time, service start, waiting duration, and departure time."),
        ("pbestᵢ, gbest, mbest", "Particle best, swarm best, and mean best position."),
        ("α, β, ρ, θ", "ACO/QACO transition exponents, evaporation rate, and QACO rotation angle; QPSO β is contraction-expansion."),
        ("R, k, N", "Number of repeated runs/blocks, number of algorithms, and sample/block count in a statistical test."),
    ], widths=[2.0, 4.5], font_size=8.8)
    add_p(doc, "End of report.")

    # Keep headings together; normalize accidental page splits in tables.
    for paragraph in doc.paragraphs:
        if paragraph.style.name.startswith("Heading"):
            paragraph.paragraph_format.keep_with_next = True
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
