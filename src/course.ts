import { COURSE_IDS, type CourseId } from "./logic";
export type ChapterNumber=1|2|3;
export type LevelNumber=1|2|3|4|5;
export interface LevelDefinition { id:CourseId; chapter:ChapterNumber; level:LevelNumber; chapterTitle:string; title:string; description:string; difficulty:string; boss:boolean; targetMinutes:number; }
export interface PlatformSpec { x:number; top:number; z:number; width:number; depth:number; }
export interface SolidSpec { x:number; y:number; z:number; width:number; height:number; depth:number; kind:"platform"|"wall"|"beam"|"vault"; }
export interface CheckpointSpec { x:number; top:number; z:number; }
export interface TokenSpec { id:string; x:number; top:number; z:number; }
export interface HintSpec { z:number; text:string; }
export interface CourseSpec extends LevelDefinition { label:string; spawn:{x:number;top:number;z:number}; startLineZ:number; finishZ:number; finishTop:number; platforms:PlatformSpec[]; walls:SolidSpec[]; obstacles:SolidSpec[]; checkpoints:CheckpointSpec[]; tokens:TokenSpec[]; hints:HintSpec[]; goldTime:number; silverTime:number; fallLimit:number; }
const CHAPTERS:Record<ChapterNumber,{title:string;challenge:string;levelTitles:[string,string,string,string,string]}> = {
  1:{title:"FOUNDATIONS",challenge:"Learn speed, gaps, slides, and your first wall transfers.",levelTitles:["First Steps","Momentum","The Switchback","Wall Practice","The Gatekeeper"]},
  2:{title:"HIGHLINE",challenge:"Longer jumps, slimmer landings, and chained wall-run transfers.",levelTitles:["Crosswind","Split Ledge","Overhang","The Long Transfer","The Sentinel"]},
  3:{title:"VELOCITY",challenge:"Expert pacing, tight sequences, quick recoveries, and sustained precision.",levelTitles:["Narrow Margin","Cross Current","Twin Walls","Final Ascent","The Apex"]}
};
export const LEVEL_DEFINITIONS:LevelDefinition[]=COURSE_IDS.map((id,index)=>{
  const chapter=(Math.floor(index/5)+1) as ChapterNumber;
  const level=((index%5)+1) as LevelNumber;
  const chapterInfo=CHAPTERS[chapter], boss=level===5;
  return {id,chapter,level,chapterTitle:chapterInfo.title,title:chapterInfo.levelTitles[level-1],
    description:boss?"Boss run · sustained traversal, tight wall transfers, and a long final sequence.":chapterInfo.challenge,
    difficulty:chapter===1?(level<3?"EASY":"INTERMEDIATE"):chapter===2?(level<3?"ADVANCED":"EXPERT"):(level<3?"EXPERT":"MASTER"),
    boss,targetMinutes:boss?14:7};
});
export function levelDefinition(id:CourseId):LevelDefinition{return LEVEL_DEFINITIONS.find(level=>level.id===id)??LEVEL_DEFINITIONS[0]!;}
const clamp=(value:number,min:number,max:number):number=>Math.min(max,Math.max(min,value));
/** Deterministic course generation preserves each level's geometry across retries and saved resumes. */
export function generateLevelCourse(id:CourseId):CourseSpec{
  const meta=levelDefinition(id),levelIndex=COURSE_IDS.indexOf(id),globalDifficulty=levelIndex/(COURSE_IDS.length-1);
  const targetSeconds=meta.boss?14*60:7*60;
  const trackLength=meta.boss?11700+(meta.chapter-1)*900:6300+(meta.chapter-1)*100+(meta.level-1)*50;
  const segmentStep=9.05+globalDifficulty*.55,segmentCount=Math.ceil(trackLength/segmentStep);
  let seed=(0x51a7c0de^Math.imul(meta.chapter,0x45d9f3b)^Math.imul(meta.level,0x119de1f3))>>>0;
  const random=():number=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x1_0000_0000;};
  const platforms:PlatformSpec[]=[{x:0,top:0,z:5,width:12,depth:14}],walls:SolidSpec[]=[],obstacles:SolidSpec[]=[];
  const checkpoints:CheckpointSpec[]=[],tokens:TokenSpec[]=[];
  let x=0,top=0;
  for(let i=1;;i++){
    const z=3.2-i*segmentStep;if(z<=-trackLength+8)break;
    const p=clamp(i/segmentCount,0,1),difficulty=clamp(globalDifficulty*.66+p*.34,0,1);
    const sideStep=.35+difficulty*.7+random()*.3;
    x=clamp(x+(random()*2-1)*sideStep,-2.7,2.7);
    const width=clamp(5.9-difficulty*1.25-p*1.2+(random()-.5)*.36,2.35,6);
    const depth=clamp(7.2-difficulty*.7-p*.75+(random()-.5)*.3,4.25,7.6);
    top=clamp(top+(random()-.5)*(.18+difficulty*.42),0,3.6);
    platforms.push({x,top,z,width,depth});
    const cpSpacing=meta.boss?410:430;
    if(i%Math.max(1,Math.round(cpSpacing/segmentStep))===0)checkpoints.push({x,top,z});
    if(i%(meta.boss?30:36)===11)tokens.push({id:"marker-"+i,x,top,z});
    const wallCadence=Math.max(9,Math.round(24-difficulty*10));
    if(i>5&&i%wallCadence===Math.floor(wallCadence/2)){
      const side=i%2===0?-1:1;
      walls.push({x:x+side*(width/2+.42),y:top+1.75,z:z-segmentStep*.43,width:.32,height:3.5,depth:segmentStep*(meta.boss?1.82:1.58),kind:"wall"});
      if(meta.boss&&i%(wallCadence*2)===0)walls.push({x:x-side*(width/2+.42),y:top+1.75,z:z-segmentStep*.4,width:.32,height:3.5,depth:segmentStep*1.6,kind:"wall"});
    }
    const cadence=Math.max(meta.boss?7:9,Math.round(18-difficulty*5));
    if(i>10&&i%cadence===4)obstacles.push({x,y:top+1.31,z:z-.18,width:Math.max(1.85,width*(.74+difficulty*.1)),height:.28,depth:.34,kind:"beam"});
    else if(difficulty>.16&&i%(cadence*2)===9)obstacles.push({x,y:top+.68,z:z-.18,width:Math.max(1.55,width*.65),height:1.22,depth:.5,kind:"vault"});
    if(meta.boss&&i>20&&i%75===0)obstacles.push({x,y:top+1.25,z:z-segmentStep*.65,width:Math.max(1.8,width*.88),height:.3,depth:.35,kind:"beam"});
  }
  platforms.push({x,top,z:-trackLength+2,width:12,depth:15});
  const hints:HintSpec[]=[
    {z:6,text:"THE TIMER STARTS AT THE ENTRY GATE. REACH THE FINISH TO COMPLETE THIS LEVEL."},
    {z:-150,text:"JUMP LATE AT A PLATFORM EDGE. SPRINT BUILDS SPEED FOR LONGER GAPS."},
    {z:-Math.round(trackLength*.22),text:"WALL-RUN: KEEP MOVING FORWARD WHILE YOU STAY BESIDE A SIDE WALL."},
    {z:-Math.round(trackLength*.43),text:"WALL-JUMP: TAP JUMP WHILE WALL-RUNNING TO LAUNCH AWAY."},
    {z:-Math.round(trackLength*.64),text:"AIM FOR THE CENTER OF EACH LANDING. SLIDE LOW AND VAULT WHEN CLOSE."},
    {z:-Math.round(trackLength*.82),text:"CHECKPOINTS SAVE YOUR PLACE. A FALL RETURNS YOU TO THE LAST ACTIVE CHECKPOINT."}
  ];
  if(meta.boss)hints.push({z:-Math.round(trackLength*.9),text:"BOSS STRETCH: KEEP MOMENTUM, READ EACH GAP, AND LINK THE WALL TRANSFERS."});
  return {...meta,label:"CHAPTER "+meta.chapter+" / LEVEL "+meta.level,spawn:{x:0,top:0,z:10},startLineZ:7.5,finishZ:-trackLength,finishTop:top,
    platforms,walls,obstacles,checkpoints,tokens,hints,goldTime:targetSeconds*1000,silverTime:(meta.boss?16:9)*60*1000,fallLimit:-22};
}
