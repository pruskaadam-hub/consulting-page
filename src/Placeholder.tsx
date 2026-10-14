import { useEffect, useRef } from 'react';
import { placeholders } from './placeholders';

export function Placeholder({id, note}: {id:keyof typeof placeholders; note?:string}) {
  const ref=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const comment=document.createComment(` TODO Adam: ${note || placeholders[id].replace(/^\[DOPLNIT: |\]$/g,'')} `);
    ref.current?.after(comment);
    return ()=>comment.remove();
  },[id,note]);
  return <span className="placeholder" data-placeholder={id} ref={ref}>{placeholders[id]}</span>;
}
