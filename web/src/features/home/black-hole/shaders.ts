/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// The black hole's shaders. GEOM and EARTH run once, a strip at a time (engine.ts);
// each frame only FLOW, the bloom and FINAL run, so a frame costs a few texture reads.
//
// Light follows a non-spinning hole, u'' = 1.5 u^2 - u (radii in Schwarzschild radii);
// the thin disk and its look after James, von Tunzelmann, Franklin & Thorne 2015
// (Class. Quantum Grav. 32 065001); the disk turns at Kepler's speed.
// Sky: NASA/Goddard SVS Deep Star Maps 2020 (Gaia DR2: ESA/Gaia/DPAC); stars generated here.
// City lights: NASA Earth Observatory, Black Marble 2016 (public domain).
import { CAM_D, FOCAL } from './scene'

export const VERTEX = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`

const DISK = `
#define PI 3.14159265359
#define TAU 6.28318530718
uniform sampler2D uTex;uniform float uT;
const float RIN=2.3,ROUT=11.,END=ROUT*1.28,FLOW=.8;
float sq(float x){return x*x;}
void shade(float r,float phi,float K,float lod,inout vec3 col,inout float T){
  float x=r/RIN,u=log(x)/log(END/RIN);
  float om=FLOW/(x*sqrt(x));
  float P=16.,p0=mod(uT,P),p1=mod(uT+P*.5,P),w=1.-abs(p0-P*.5)/(P*.5);
  float o0=fract(floor(uT/P)*.37),o1=fract(floor((uT+P*.5)/P)*.61+.5);
  vec2 a=textureLod(uTex,vec2((phi+om*p0)/TAU+o0,u),lod).rg;
  vec2 b=textureLod(uTex,vec2((phi+om*p1)/TAU+o1,u),lod).rg;
  vec2 n=clamp((mix(b,a,w)-.5)*inversesqrt(w*w+(1.-w)*(1.-w))+.5,0.,1.);
#if STIR
  float hot=uHot>0.?texture(uWake,vec2(phi/TAU,clamp(u,0.,1.))).r*uHot:0.;
  float hc=clamp(hot,0.,1.);
  n=mix(n,vec2(1.),hc*.72);
#endif
  float inner=smoothstep(RIN-.04,RIN+.2,r);
  float outer=1.-smoothstep(ROUT*.48,ROUT*1.2,r+(n.y-.5)*ROUT*.3);
  float dens=inner*outer*(.05+1.45*pow(n.x,2.2))*(.32+.9*n.y)*mix(1.5,.3,smoothstep(RIN,ROUT,r));
  float al=1.-exp(-dens*.3*K);
  float S=.72+1.75/(x*x);
  vec3 tint=mix(vec3(1.,.64,.36),vec3(1.,.87,.72),smoothstep(.02,.5,al));
#if STIR
  S*=1.+1.7*hot;
  tint=mix(tint,vec3(.66,.8,1.2)*dot(tint,vec3(.33)),hc*.75);
#endif
  col+=T*al*S*tint*1.6;
  T*=1.-al;
}`

/** The picture of the sky round the hole: half its width, as the tangent of the angle off the hole */
const SKY_SPAN = 1.3

const CAMERA = `const float D=${CAM_D.toFixed(1)},FOC=${FOCAL.toFixed(2)};
const vec3 SKY_DARK=vec3(.0013,.002,.0042);`

const WALK = `void walk(vec3 ro,vec3 rd,float pa,bool keep,out vec2 p0,out vec2 p1,out vec4 kl,out vec3 still,out vec3 vo,out float T,out float cap){
  p0=p1=vec2(0.);kl=vec4(0.);still=vec3(0.);vo=rd;T=1.;cap=0.;
  vec3 hv=cross(ro,rd),x=ro,v=rd;
  float h2=dot(hv,hv),bb=sqrt(h2);
  float far=ROUT*1.4+6.;
  if(bb>far){
    vec3 nn=normalize(ro+rd*dot(-ro,rd));
    vo=normalize(rd-nn*2./bb);
    return;
  }
  float esc=max(length(ro)*1.05,far+6.),dist=0.;
  int hits=0;
  for(int i=0;i<420;i++){
    float r2=dot(x,x),r=sqrt(r2);
    if(r<1.01){cap=1.;break;}
    if(r>esc&&dot(x,v)>0.)break;
    float ds=clamp(.06*r*min(1.,r*.4),.008,3.);
    vec3 a=-1.5*h2*x/(r2*r2*r);
    vec3 vh=v+a*ds*.5,x1=x+vh*ds;
    float q2=dot(x1,x1);
    a=-1.5*h2*x1/(q2*q2*sqrt(q2));
    v=vh+a*ds*.5;
    if(x.y*x1.y<0.){
      float f=x.y/(x.y-x1.y);
      vec3 pc=mix(x,x1,f);
      float rc=length(pc.xz);
      if(rc>RIN-.2&&rc<END){
        vec3 vn=normalize(v);
        float phi=atan(pc.z,pc.x),vy=abs(vn.y),fa=pa*(dist+f*ds),ls=log(END/RIN);
        float lod=log2(max(max(fa/max(vy,.04)/(rc*ls)*512.,fa/rc/TAU*4096.),1.));
        if(!keep||hits>=2)lod+=4.;
        float K=1./max(vy,.03);
        if(keep&&hits==0){p0=vec2(rc,phi);kl.xy=vec2(K,lod);}
        else if(keep&&hits==1){p1=vec2(rc,phi);kl.zw=vec2(K,lod);}
        else if(T>.01)shade(rc,phi,K,lod,still,T);
        hits++;
      }
    }
    x=x1;dist+=ds;
  }
  vo=normalize(v);
}`

export const GEOM = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
#define STIR 0
uniform vec2 uRes;uniform vec3 uView;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
layout(location=2) out vec4 o2;
layout(location=3) out vec4 o3;
${DISK}
${CAMERA}
float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.103,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
uniform sampler2D uSky;
vec3 gF,gR,gU;float gK=1.,gPa=1.,gDim=1.,gFx=0.,gFy=0.,gEll=9.,gRad=9.,gLow=0.;
/* stars are points: the lens moves and brightens them, never draws them into scratches.
   Soft edges, and brightness after the real count N(>F) ~ F^-1.5: few bright, many faint */
vec3 stars(vec3 d,vec3 cx,vec3 cy,float sc,float dens,float sig,float lo,float hi,vec3 c0,vec3 c1,float near){
  float a11=dot(cx,cx),a12=dot(cx,cy),a22=dot(cy,cy),det=a11*a22-a12*a12;
  if(det<1e-22)return vec3(0.);
  vec3 id=floor(d*sc);
  if(hash13(id)>dens)return vec3(0.);
  vec3 dd=normalize((id+.5+(hash33(id)-.5)*.7)/sc)-d;
  float b1=dot(cx,dd),b2=dot(cy,dd);
  vec2 v=vec2(a22*b1-a12*b2,a11*b2-a12*b1)/det;
  float F=min(hi,lo*pow(max(hash13(id+7.3),1e-4),-.667));
  float s=max(.5,sig*max(gK,.55)*(1.+.3*log(F/lo)));
  float l=length(v);
  if(l>s*4.)return vec3(0.);
  float mag=min(gPa*gPa/sqrt(det),2.5);
  return mix(c0,c1,hash13(id+3.1))*exp(-.5*l*l/(s*s))*F*mag*gDim*near*min(1.,gK*gK*1.4+.1);
}
/* A cold cloud in the far corners and NASA's Milky Way low on the left around the Earth.
   Cloud (r), Milky Way (g) and how stars clump (b) are one small picture, made ahead of time */
vec3 sky(vec3 d,vec3 cx,vec3 cy){
  const vec3 cool0=vec3(.74,.85,1.),cool1=vec3(.92,.96,1.),warm=vec3(1.,.9,.76),pale=vec3(.84,.89,1.);
  /* a picture's rows run downward */
  vec3 n=textureLod(uSky,vec2(dot(d,gR),-dot(d,gU))/max(dot(d,gF),.2)/${(SKY_SPAN * 2).toFixed(1)}+.5,0.).rgb;
  float near=mix(.14,1.,smoothstep(.78,1.25,gEll)),low=gLow,v=n.r,I=n.g*low;
  /* the cloud stays far from the hole: close in, the lens would wind it into a vortex */
  float cloud=smoothstep(.98,1.75,gEll)*smoothstep(.92,1.55,gRad)*(1.-.8*low);
  float words=mix(.42,1.,1.-smoothstep(.3,.14,gFx)*smoothstep(.62,.8,gFy));
  vec3 c=SKY_DARK+mix(vec3(.012,.03,.07),vec3(.03,.072,.15),min(v*1.3,1.))*v*1.08*words*cloud
    +mix(vec3(.46,.54,.78),vec3(.98,.86,.74),smoothstep(.25,.9,I))*.105*pow(I,1.5);
  float e=smoothstep(.16,.62,I);
  return c
    +stars(d,cx,cy,54.,.05*smoothstep(.16,.62,n.b-.12)+.008+.03*e,.72,.055,1.7,mix(cool0,warm,low),mix(cool1,pale,low),near)
    +stars(d,cx,cy,270.,.11*e,.54,.016+.024*e,.28,warm,pale,near);
}
${WALK}
void main(){
  float den=min(uRes.y,uRes.x/uView.z);
  vec2 q=(gl_FragCoord.xy*2.-uRes)/den-uView.xy;
  float px=2./den,pa=px/FOC;
  vec3 ro=D*vec3(0.,sin(radians(15.)),cos(radians(15.)));
  float ca=cos(radians(9.)),sa=sin(radians(9.));
  q=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);
  vec3 f=normalize(-ro),rt=normalize(cross(f,vec3(0.,1.,0.))),up=cross(rt,f);
  vec3 rd=normalize(q.x*rt+q.y*up+FOC*f);
  float b0=length(cross(ro,rd));
  gK=den/1080.;gPa=pa;
  /* the sky keeps out of the words and the disk; q is now along the disk (x) and across it (y) */
  gFy=gl_FragCoord.y/uRes.y;gFx=abs(gl_FragCoord.x/uRes.x-.5);
  gDim=mix(1.,.22,smoothstep(.27,.19,gFx)*smoothstep(.7,.76,gFy));
  gEll=length(q/vec2(1.35,.62));
  gRad=length(q);
  gF=f;gR=rt;gU=up;
  gLow=smoothstep(.02,-.42,q.y)*smoothstep(-.1,-.75,q.x);
  vec2 a0=vec2(0.),a1=vec2(0.);vec4 kl=vec4(0.);vec3 st=vec3(0.),vo0=rd;float T0=1.,cap0=1.;
  /* the photon ring is left to RING, which draws where this is under .055. Its edge (.054 to .056)
     gets one whole still pixel here, right whether RING draws over it or not, so the two programs
     never have to agree to the last bit */
  float rb=abs(b0-2.61);
  if(rb>=.054)walk(ro,rd,pa,rb>=.056,a0,a1,kl,st,vo0,T0,cap0);
  vec3 dx=dFdx(vo0),dy=dFdy(vo0);
  if(cap0<.5&&T0>.004)st+=T0*sky(vo0,dx,dy);
  o0=vec4(a0,0.,0.);o1=vec4(a1,0.,0.);o2=kl;o3=vec4(min(st,vec3(60.)),1.);
}`

/**
 * The photon ring is very thin: more rays. Writes over the still light GEOM left at zero.
 * GEOM has four outputs, and Direct3D compiles those on the GPU's main thread at the first draw
 * (ANGLE only prepares one output at link). RING has one, so it compiles in the background: the
 * twelve rays of the photon ring live here, which takes about a third off that stall.
 */
export const RING = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
#define STIR 0
uniform vec2 uRes;uniform vec3 uView;
out vec4 outC;
${DISK}
${CAMERA}
${WALK}
void main(){
  float den=min(uRes.y,uRes.x/uView.z);
  vec2 q=(gl_FragCoord.xy*2.-uRes)/den-uView.xy;
  float px=2./den,pa=px/FOC;
  vec3 ro=D*vec3(0.,sin(radians(15.)),cos(radians(15.)));
  float ca=cos(radians(9.)),sa=sin(radians(9.));
  q=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);
  vec3 f=normalize(-ro),rt=normalize(cross(f,vec3(0.,1.,0.))),up=cross(rt,f);
  if(abs(length(cross(ro,normalize(q.x*rt+q.y*up+FOC*f)))-2.61)>=.055)discard;
  vec3 sum=vec3(0.);
  for(int i=0;i<12;i++){
    float a=float(i)*2.39996+.4,rr=sqrt((float(i)+.5)/12.)*.62*px;
    vec2 w=q+vec2(cos(a),sin(a))*rr;
    vec2 d0,d1;vec4 dk;vec3 s,vv;float Tt,kk;
    walk(ro,normalize(w.x*rt+w.y*up+FOC*f),pa,false,d0,d1,dk,s,vv,Tt,kk);
    sum+=s+Tt*(1.-kk)*SKY_DARK;
  }
  outC=vec4(min(sum/12.,vec3(60.)),1.);
}`

export const EARTH = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform vec2 uRes;uniform vec2 uOff;uniform vec2 uHole;uniform vec3 uEarthP;uniform vec3 uLook;uniform float uAsp;uniform sampler2D uEarth;
out vec4 outC;
#define PI 3.14159265359
#define TAU 6.28318530718
vec4 earth(vec2 uv,float px){
  vec2 p=(uv-uEarthP.xy)/uEarthP.z;
  float d=length(p),pn=px/uEarthP.z;
  if(d>1.14)return vec4(0.);
  vec3 Lv=normalize(vec3((uHole-uEarthP.xy)*.34,-1.));
  float z=sqrt(max(1.-d*d,0.));
  vec3 n=vec3(p,z);
  float al=smoothstep(1.+pn,1.-pn,d);
  vec3 col=vec3(0.);
  vec2 ldir=normalize(Lv.xy+1e-5);
  float f=smoothstep(-.35,.45,dot(p/max(d,1e-4),ldir));
  if(al>0.){
    float ra=radians(uLook.z),c=cos(ra),s=sin(ra);
    vec3 m=vec3(c*n.x-s*n.y,s*n.x+c*n.y,n.z);
    float la=radians(uLook.x),lo=radians(uLook.y);
    vec3 up=vec3(cos(la)*cos(lo),cos(la)*sin(lo),sin(la));
    vec3 ea=vec3(-sin(lo),cos(lo),0.);
    vec3 no=vec3(-sin(la)*cos(lo),-sin(la)*sin(lo),cos(la));
    vec3 w=normalize(m.x*ea+m.y*no+m.z*up);
    vec2 tuv=vec2(atan(w.y,w.x)/TAU+.5,.5-asin(clamp(w.z,-1.,1.))/PI);
    float lod=log2(max(326.*pn/max(z,.15),1.))-.5;
    float l=textureLod(uEarth,tuv,max(lod,0.)).r;
    float lin=max(l*l/1.9-.0035,0.);
    float nl=dot(n,Lv);
    float day=smoothstep(-.03,.2,nl);
    col+=vec3(1.,.7,.38)*lin*13.*(1.-day)*smoothstep(0.,.14,z);
    col+=vec3(.012,.018,.032)*(.25+.75*z)*(1.-day);
    col+=vec3(.32,.36,.42)*max(nl,0.)*1.2;
    float rim=pow(1.-z,6.);
    col+=rim*(vec3(.28,.48,1.)*1.4*f+vec3(.16,.42,.26)*.08*(1.-f));
    col*=al;
  }
  if(d>.985){
    float g=exp(-max(d-1.,0.)/.022);
    float thin=mix(.05,1.,f*f);
    col+=vec3(.34,.55,1.)*g*1.05*thin*(1.-al*.7);
    col+=vec3(1.,.76,.55)*exp(-max(d-1.,0.)/.008)*.9*f*f*f*(1.-al*.7);
  }
  return vec4(col,al);
}
void main(){
  float den=min(uRes.y,uRes.x/uAsp),px=2./den;
  vec2 uv=((gl_FragCoord.xy+uOff)*2.-uRes)/den;
  vec4 s=vec4(0.);
  for(int i=0;i<8;i++){
    float a=float(i)*2.39996+.3,rr=sqrt((float(i)+.5)/8.)*.62*px;
    s+=earth(uv+vec2(cos(a),sin(a))*rr,px);
  }
  outC=s/8.;
}`

export const FLOW = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
#define STIR 1
uniform sampler2D uG0,uG1,uG2,uG3,uE,uWake;uniform float uHot;uniform vec4 uLens;uniform ivec4 uBox;uniform ivec2 uSize;
out vec4 outC;
${DISK}
void main(){
  vec2 fc0=gl_FragCoord.xy;
  ivec2 ip=ivec2(fc0);
  vec4 e=vec4(0.);
  if(ip.x>=uBox.x&&ip.y>=uBox.y&&ip.x<uBox.z&&ip.y<uBox.w){
    e=texelFetch(uE,ip-uBox.xy,0);
    if(e.a>.999){outC=vec4(e.rgb,1.);return;}
  }
  /* the pointer is a small mass: light from behind it bends (point lens); the Earth is in front of it */
  vec2 fc=fc0;
  if(uLens.w>0.){
    vec2 dg=fc0-uLens.xy;
    float d2=dot(dg,dg),rg2=uLens.z*uLens.z;
    if(d2<49.*rg2)fc-=uLens.w*dg*rg2/(d2+.06*rg2)*(1.-smoothstep(2.5*uLens.z,6.5*uLens.z,sqrt(d2)));
  }
  ivec2 g=clamp(ivec2(fc),ivec2(0),uSize-1);
  vec4 s=texelFetch(uG3,g,0);
  vec2 a=texelFetch(uG0,g,0).rg;
  if(fc!=fc0){
    vec2 gp=fc-.5,fr=fract(gp);ivec2 i0=clamp(ivec2(floor(gp)),ivec2(0),uSize-2);
    vec2 a00=texelFetch(uG0,i0,0).rg,a10=texelFetch(uG0,i0+ivec2(1,0),0).rg,a01=texelFetch(uG0,i0+ivec2(0,1),0).rg,a11=texelFetch(uG0,i0+ivec2(1,1),0).rg;
    float lo=min(min(a00.x,a10.x),min(a01.x,a11.x)),hi=max(max(a00.x,a10.x),max(a01.x,a11.x));
    if(lo>0.&&hi-lo<.6){
      vec2 ref=a00;
      a10.y=ref.y+atan(sin(a10.y-ref.y),cos(a10.y-ref.y));a01.y=ref.y+atan(sin(a01.y-ref.y),cos(a01.y-ref.y));a11.y=ref.y+atan(sin(a11.y-ref.y),cos(a11.y-ref.y));
      a=mix(mix(a00,a10,fr.x),mix(a01,a11,fr.x),fr.y);
    }
    s.rgb=mix(mix(texelFetch(uG3,i0,0).rgb,texelFetch(uG3,i0+ivec2(1,0),0).rgb,fr.x),mix(texelFetch(uG3,i0+ivec2(0,1),0).rgb,texelFetch(uG3,i0+ivec2(1,1),0).rgb,fr.x),fr.y);
  }
  vec3 col=vec3(0.);float T=1.;
  if(a.x>0.){
    vec4 kl=texelFetch(uG2,g,0);
    shade(a.x,a.y,kl.x,kl.y,col,T);
    vec2 b=texelFetch(uG1,g,0).rg;
    if(b.x>0.&&T>.01)shade(b.x,b.y,kl.z,kl.w,col,T);
  }
  outC=vec4((col+T*s.rgb)*(1.-e.a)+e.rgb,1.);
}`

export const WAKE = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D uPrev,uG0;uniform vec4 uStep;uniform ivec2 uPtr;uniform vec2 uSrc;uniform vec2 uR;
out vec4 outC;
#define TAU 6.28318530718
const float RIN=2.3,END=11.*1.28;
void main(){
  vec2 st=gl_FragCoord.xy/uR;
  float u=st.y,r=RIN*exp(u*log(END/RIN)),phi=st.x*TAU;
  float x=r/RIN,om=uStep.y/(x*sqrt(x));
  float from=r+uStep.w*uStep.x/(x*x);
  float v=texture(uPrev,vec2((phi+om*uStep.x)/TAU,log(from/RIN)/log(END/RIN))).r*uStep.z;
  if(uSrc.y>0.){
    vec2 hit=texelFetch(uG0,uPtr,0).rg;
    if(hit.x>0.){
      vec2 d=r*vec2(cos(phi),sin(phi))-hit.x*vec2(cos(hit.y),sin(hit.y));
      v+=uSrc.y*exp(-dot(d,d)/(uSrc.x*uSrc.x));
    }
  }
  outC=vec4(min(v,2.5),0.,0.,1.);
}`

export const BAKE_DISK = `#version 300 es
precision highp float;uniform vec2 uRes;out vec4 outC;
#define TAU 6.28318530718
float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
float pn(vec2 st,float ka,float kr,float s){float a=st.x*TAU;return n3(vec3(cos(a)*ka,sin(a)*ka,st.y*kr)+s);}
void main(){
  vec2 st=gl_FragCoord.xy/uRes;
  vec2 q=vec2(st.x+(pn(st,2.,7.,3.)-.5)*.1,st.y+(pn(st,3.,9.,9.)-.5)*.05);
  float f=.3*pn(q,1.7,44.,1.)+.25*pn(q,3.6,110.,5.)+.2*pn(q,8.,240.,8.)+.14*pn(q,17.,480.,11.)+.11*pn(q,34.,900.,14.);
  f=smoothstep(.3,.7,f);
  float c=.46*pn(st,5.,15.,20.)+.28*pn(st,12.,32.,24.)+.17*pn(st,26.,62.,27.)+.09*pn(st,60.,120.,31.);
  c=smoothstep(.3,.71,c);
  outC=vec4(f,c,0.,1.);
}`

export const DOWN = `#version 300 es
precision highp float;uniform sampler2D uS;uniform vec2 uPx;uniform float uThr;out vec4 outC;
void main(){vec2 uv=gl_FragCoord.xy*uPx;vec2 o=uPx*.5;
  vec3 c=(texture(uS,uv+o).rgb+texture(uS,uv-o).rgb+texture(uS,uv+vec2(o.x,-o.y)).rgb+texture(uS,uv+vec2(-o.x,o.y)).rgb)*.25;
  if(uThr>0.){float l=max(c.r,max(c.g,c.b));c*=smoothstep(uThr*.5,uThr*1.5,l);}
  outC=vec4(c,1.);}`

export const UP = `#version 300 es
precision highp float;uniform sampler2D uS,uAdd;uniform vec2 uPx;uniform float uMix;out vec4 outC;
void main(){vec2 uv=gl_FragCoord.xy*uPx;vec2 o=uPx;
  vec3 c=texture(uS,uv).rgb*4.;
  c+=(texture(uS,uv+vec2(o.x,0)).rgb+texture(uS,uv-vec2(o.x,0)).rgb+texture(uS,uv+vec2(0,o.y)).rgb+texture(uS,uv-vec2(0,o.y)).rgb)*2.;
  c+=texture(uS,uv+o).rgb+texture(uS,uv-o).rgb+texture(uS,uv+vec2(o.x,-o.y)).rgb+texture(uS,uv+vec2(-o.x,o.y)).rgb;
  outC=vec4(texture(uAdd,uv).rgb+c/16.*uMix,1.);}`

export const FINAL = `#version 300 es
precision highp float;uniform sampler2D uS,uB;uniform vec2 uRes;uniform float uT,uGrain;out vec4 outC;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
void main(){vec2 uv=gl_FragCoord.xy/uRes;
  vec3 c=texture(uS,uv).rgb+texture(uB,uv).rgb*vec3(1.,.9,.78)*.4;
  vec2 v=uv-.5;c*=1.-dot(v,v)*.4;
  c=pow(aces(c),vec3(1./2.2));
  c+=(h(gl_FragCoord.xy+fract(uT)*91.)-.5)*uGrain;
  outC=vec4(c,1.);}`
