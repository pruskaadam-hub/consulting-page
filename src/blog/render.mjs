import { Marked } from 'marked';

export const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
/** Render authored Markdown with safe links and visible editorial TODOs. */
export function renderBlogMarkdown(markdown,{home,blogLink}) {
  const parser=new Marked({gfm:true,breaks:false});
  parser.use({renderer:{
    html({text}) { return escapeHtml(text); },
    heading({depth,tokens}) {
      const level=Math.max(2,depth-1);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    link({href,title,tokens}) {
      const label=this.parser.parseInline(tokens);
      const target=href==='#rezervace' || href==='#firmy' ? home+href : href;
      if(!target || !/^(https?:\/\/|\/|#)/.test(target))return label;
      const external=/^https?:\/\//.test(target);
      const cta=href==='#rezervace' || href==='#firmy';
      return `<a href="${escapeHtml(target)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}${cta ? ' class="button primary article-authored-cta"' : ''}>${label}</a>`;
    },
  }});
  let html=parser.parse(markdown);
  html=html.replace(/\[(?:ověřit[^\]]*|DOPLNIT[^\]]*)\]/g,marker=>`<span class="placeholder editorial-todo">${marker}</span><!-- TODO Adam: ověřit před publikací -->`);
  html=html.replace('článku o entry pointech do Švýcarska',`<a href="${escapeHtml(blogLink('prace-ve-svycarsku-entry-point'))}">článku o entry pointech do Švýcarska</a>`);
  return html;
}
export function articleStructuredData(post,url,imageUrl) {
  return {
    '@context':'https://schema.org','@type':'Article',headline:post.title,
    description:post.description,author:{'@type':'Person',name:'Adam Pruška'},
    inLanguage:'cs',mainEntityOfPage:{'@type':'WebPage','@id':url},url,image:imageUrl,
    // Unknown publication dates are deliberately omitted, never invented.
  };
}
