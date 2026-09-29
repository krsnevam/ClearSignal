# AI usage disclosure

The ClearSignal concept, prose, and product realization used the following AI systems:

- **Claude (Anthropic)**: architecture review and copy-editing of the submission text and build spec.
- **Claude Code (Anthropic, Claude Opus 5.5)**: generated the initial implementation of this repository from the build spec, including the monorepo scaffold, the fusion engine and its golden test, the Kodagu 2018 scenario generator, the edge API and SMS webhook, the PWA screens, the Python adapters, the CI workflows, and first drafts of these documents. The team reviewed, ran and tested the output.

<!-- Add any further tools actually used (e.g. Cursor, v0.dev, Bolt.new) with what each did. List only tools that were really used. -->

No AI system is present at runtime in the deployed ClearSignal product. The confidence engine is a deterministic linear function specified in `packages/fusion/weights.yaml` and served publicly at `/weights`. No machine-learning inference is performed on device or on the backend. Data adapters convert third-party feeds into a common schema without any generative or ranking model. Citizen SMS are parsed with fixed keyword rules (village names, "safe"/"not safe"), not a language model.

Volunteers in the 90-second comprehension drill were human, over 18, and consented to being recorded for the video and this documentation.
