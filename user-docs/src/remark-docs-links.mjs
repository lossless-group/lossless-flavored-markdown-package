// The guides in ../docs-v link to each other as `headings.md`, and the README
// links to them as full GitHub URLs, because both are read on GitHub and JSR
// too. On this site those links should open the page here instead. Also drops
// each file's leading `# Title`: Starlight prints the title from frontmatter.
const REPO = 'https://github.com/lossless-group/lossless-flavored-markdown-package';
const GITHUB_DOC = new RegExp(`^${REPO}/(?:blob|tree)/[\\w.-]+/docs-v/?([\\w-]+)?(?:\\.md)?(#.*)?$`);
const LOCAL_DOC = /^(?:\.\/)?([\w-]+)\.md(#.*)?$/;

export function remarkDocsLinks({ base }) {
  const page = (slug, hash = '') => (!slug || slug === 'index' ? base : `${base}${slug}/`) + hash;

  return (tree) => {
    if (tree.children[0]?.type === 'heading' && tree.children[0].depth === 1) tree.children.shift();

    const walk = (node) => {
      if (node.type === 'link' || node.type === 'definition') {
        const github = GITHUB_DOC.exec(node.url);
        const local = LOCAL_DOC.exec(node.url);
        if (github) node.url = page(github[1], github[2]);
        else if (local) node.url = page(local[1], local[2]);
        // `../changelog/…` and other repo files: read them on GitHub.
        else if (node.url.startsWith('../')) node.url = `${REPO}/blob/master/${node.url.slice(3)}`;
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}
