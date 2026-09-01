---
date: "2026-08-22T07:00:40.506Z"
symptom: "他人语音被声纹过滤时（passed=False）执行到 speech_cli.py:1791 抛 NameError: SPEAKER_THRESH 未定义，过滤提示缺失"
component: "speech_cli.py"
severity: "major"
status: "open"
root_cause: "8-21 阈值收口修复未在 speech_cli.py 真正落地：未导入 SPEAKER_THRESH（悬空引用）且 verify_speaker 仍硬编码 0.65"
fix: "从 config 导入 SPEAKER_THRESH 并在 verify_speaker/_auto_enroll/提示文案统一使用（待修，本次仅审查未改动）"
related_files:
  - "speech_cli.py"
  - "config.py"
  - "cli_simple.py"
---

审查发现：speech_cli.py 第 1791 行 f-string 使用 SPEAKER_THRESH（"语音未通过声纹验证 (相似度 x < SPEAKER_THRESH)"提示），但：① 第 67-72 行 from config import 列表（DATA_DIR/DB_PATH/LLM_CONFIG_PATH/TEMPLATES_DIR/TEMPLATE_PATH/PROFILE_PATH/KB_DB_PATH/KB_DIR/SAMPLE_RATE/VAD_FRAME/VAD_THRESHOLD/SILENCE_SEC/MIN_SPEECH_SEC/SILICONFLOW_*）不含 SPEAKER_THRESH；② 全文件 grep 无 'SPEAKER_THRESH =' 赋值，无 import config 模块；③ AST 静态分析确认模块 imports 无 SPEAKER_THRESH 也无 config。声纹过滤失败路径（passed=False）执行该行必抛 NameError。同时 verify_speaker 内部实际硬编码阈值 0.65（第 205 行 return best_sim >= 0.65），cli_simple.py:130 也硬编码 0.65，realtime_asr.py 不引用 SPEAKER_THRESH —— CHANGELOG 2026-08-21 声称的"P1 阈值收口 SPEAKER_THRESH 统一至 config.py、speech_cli 复用"未真正落地；PROJECT.md 自身矛盾（124 行写默认 0.3，129 行写默认 0.55，实际 config.py 默认 0.3 但 speech_cli 用 0.65）。
