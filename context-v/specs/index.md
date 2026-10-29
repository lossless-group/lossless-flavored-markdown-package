# Specs

* [Maintain Directives In Extended Markdown Render Pipeline](Maintain-Directives-in-Extended-Markdown-Render-Pipeline.md) - Directives bring MDX like component rendering using special extended markdown syntax.
* [Maintain Embeddable Images with Style Props](Maintain-Embeddable-Images-with-Style-Props.md) - An unrecognised prop on an image directive does nothing at all — no error, no warning, no render difference. The discipline that ends that.
* [Maintain Eyebrow, Heading and Subheading Blocks](Maintain-Eyebrow-Heading-Subheading-Blocks.md) - Cards have had a three-part heading for years — eyebrow, heading, subheading — and long articles need it more than cards do. Three adjacent lines, one semantic unit, one `<hgroup>`, and only the middle one ever reaches the table of contents.
* [Maintain Figma Object Embeds Using Embed Kit](Maintain-Figma-Object-Embeds-using-Embed-Kit.md) - Embed live Figma files, frames, and prototypes inside markdown via the `:figma-embed` text directive — width, height, and auth-user as attributes.
* [Maintain Heading Anchors And Share Links](Maintain-Heading-Anchors-and-Share-Links.md) - A fragment URL is a public contract, and we currently ship two incompatible definitions of it. This moves anchor identity into LFM as data, leaves the share affordance in the render layer, and fixes collisions nobody is handling.
* [Maintain an Elegant Markdown and Extended Markdown Render Pipeline](Maintain-Lossless-Markdown-and-Extended-Markdown-Render-Pipeline.md)
* [Maintain Path Resolution for Wikilinks](Maintain-Path-Resolution-for-Wikilinks.md) - How vault paths become site routes — the index cascade, why ambiguity refuses to guess, and the rule that every judgment call is a config field rather than a decision baked into the package.
* [Render AST in Debug](Render-AST-in-Debug.md) - Exploration of AST structure at each stage of markdown processing to understand how to handle callouts
