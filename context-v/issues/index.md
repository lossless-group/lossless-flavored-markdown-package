# Issues

* [Heading Outline Cannot Distinguish Container Headings from Document Headings](Heading-Outline-Cannot-Distinguish-Container-Headings.md) - `tree.data.headings` collects a `###` inside a `> [!info]` callout as a document section — right for anchors, wrong for a table of contents.
* [JSR Export Map Omits the Formats Subpaths](JSR-Export-Map-Omits-the-Formats-Subpaths.md) - `deno.json` declares two exports; `package.json` declares six. The four it omits are the entire code-fence format registry — so the feature 0.4.1 was built around is unreachable for every consumer that installs from JSR, which is all nine of them.
* [Workspace vs JSR for LFM Consumers](Workspace-vs-JSR-for-LFM-Consumers.md) - Why most consumer sites should pin @lossless-group/lfm to JSR while exactly one acts as the local workspace sandbox — and the boring deploy-host failure mode that forces the discipline.
