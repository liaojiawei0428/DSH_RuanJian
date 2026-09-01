---
date: "2026-08-23T05:19:22.914Z"
symptom: "config.SPEAKER_THRESH=0.3 死配置：声纹验证实际硬编码 0.65、收录 0.70、VAD 0.008/0.02 多处硬编码，环境变量覆盖不生效"
component: "config.py + speech_cli.py + cli_simple.py + realtime_asr.py"
severity: "minor"
status: "fixed"
root_cause: "8-21 声称的\"阈值统一收口\"只改了 config.py 定义，未替换 speech_cli/cli_simple/realtime_asr 内的硬编码引用，导致 config 常量成为死配置。"
fix: "config.py 默认值对齐实测（SPEAKER_THRESH 0.65、ENROLL_MIN_SIM 0.70）+ 新增 VAD_ENERGY_RMS/VAD_SPEAKING_RMS；speech_cli/cli_simple/realtime_asr 全部硬编码引用改为 config 常量。"
related_files:
---

8-21 CHANGELOG 声称"SPEAKER_THRESH 统一收口至 config.py"，但审计发现实际未落地：config.SPEAKER_THRESH=0.3 成为死配置（仅失败提示文案使用），verify_speaker 硬编码 0.65、_auto_enroll 硬编码 0.70、cli_simple.py 硬编码 0.65、VAD 能量阈值 0.008/0.02 在 speech_cli/cli_simple/realtime_asr 三处硬编码。导致环境变量 SPEAKER_THRESH 覆盖不生效、提示阈值与实际验证阈值不一致。修复：config.py 默认值对齐实测（SPEAKER_THRESH 0.3→0.65、ENROLL_MIN_SIM 0.60→0.70），新增 VAD_ENERGY_RMS=0.008/VAD_SPEAKING_RMS=0.02 常量；speech_cli.py 的 verify_speaker/_auto_enroll/vad_loop 及启动文案、cli_simple.py 的声纹阈值和 VAD、realtime_asr.py 的 VAD 全部改为引用 config 常量。验证：py_compile 4 文件通过，grep 确认 0.65/0.70/0.008/0.02 阈值硬编码零残留，5 个回归测试文件（17+37+66+11+15）全部通过，默认行为不变（默认阈值与原先实际值一致）。
