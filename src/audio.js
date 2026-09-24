// Sound is decorative only; it never changes the world or its clock.
export class Soundscape {
 constructor(){this.enabled=false;this.volume=.15;this.context=null;}
 async toggle(){this.enabled=!this.enabled;if(this.enabled){this.context??=new (window.AudioContext||window.webkitAudioContext)();await this.context.resume();this.chime(0);}return this.enabled;}
 setVolume(v){this.volume=Math.max(0,Math.min(.6,v));}
 chime(severity=1){if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime;[174.61,261.63,severity>1?349.23:293.66].forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(0,t+i*.13);gain.gain.linearRampToValueAtTime(this.volume*.13,t+i*.13+.1);gain.gain.exponentialRampToValueAtTime(.0001,t+i*.13+2);osc.connect(gain).connect(ctx.destination);osc.start(t+i*.13);osc.stop(t+i*.13+2.1);});}
}
