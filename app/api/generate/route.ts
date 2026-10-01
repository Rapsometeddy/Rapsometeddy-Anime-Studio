import {NextResponse} from "next/server";

const demoEpisode = (title:string, story:string, song:string) => ({
  title,
  logline: story.slice(0,180),
  song,
  characters: [
    {name:"Lead",role:"protagonist",appearance:"distinctive original anime lead with a memorable silhouette"},
    {name:"Rival",role:"antagonist or rival",appearance:"distinctive original anime rival with contrasting silhouette"}
  ],
  scenes: [
    {number:1,title:"Opening",prompt:"Cinematic anime establishing shot based on the story."},
    {number:2,title:"Character Introduction",prompt:"Anime character introduction with a consistent visual design."},
    {number:3,title:"Conflict",prompt:"Dramatic anime scene showing the central conflict."},
    {number:4,title:"Climax",prompt:"Dynamic cinematic anime climax."},
    {number:5,title:"Ending",prompt:"Emotional anime closing shot with room for the song."}
  ]
});

export async function POST(req:Request){
  const {title="Untitled Episode",story="",song=""}=await req.json().catch(()=>({}));
  if(!story.trim()) return NextResponse.json({error:"Add a story or concept first."},{status:400});

  const systemPrompt = "Return valid JSON only with keys title, logline, characters, scenes, music_direction. You are an original anime showrunner. Create original characters and scenes from the user's story.";
  const userPrompt = `Title: ${title}\nStory: ${story}\nSong: ${song}`;

  // Free-first: Gemini's documented free tier is preferred when a Gemini key is configured.
  if(process.env.GEMINI_API_KEY){
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY},
      body:JSON.stringify({
        contents:[{role:"user",parts:[{text:`${systemPrompt}\n\n${userPrompt}`}]}],
        generationConfig:{temperature:0.8,responseMimeType:"application/json"}
      })
    });
    if(r.ok){
      const d=await r.json();
      const c=d.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";
      try{return NextResponse.json({mode:"ai",provider:"gemini",episode:JSON.parse(c)})}catch{}
    }
    if(!process.env.OPENAI_API_KEY){
      const errorText=await r.text().catch(()=>"");
      return NextResponse.json({error:`Gemini request failed: ${errorText.slice(0,500)}`},{status:502});
    }
  }

  if(process.env.OPENAI_API_KEY){
    const r=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-4o-mini",
        temperature:.8,
        messages:[
          {role:"system",content:systemPrompt},
          {role:"user",content:userPrompt}
        ],
        response_format:{type:"json_object"}
      })
    });
    if(r.ok){
      const d=await r.json();
      const c=d.choices?.[0]?.message?.content||"{}";
      try{return NextResponse.json({mode:"ai",provider:"openai",episode:JSON.parse(c)})}catch{}
    }
    return NextResponse.json({error:"AI provider request failed."},{status:502});
  }

  return NextResponse.json({
    mode:"demo",
    episode:demoEpisode(title,story,song),
    notice:"Demo mode is active. Add GEMINI_API_KEY in Vercel for free-first AI script generation."
  });
}