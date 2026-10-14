import metadata from './blog/metadata.json' with {type:'json'};
const sources=import.meta.glob('./blog/*.md',{query:'?raw',import:'default',eager:true});
export const blogPosts=metadata.map(post=>({...post,markdown:String(sources[`./blog/${post.slug}.md`])}));
