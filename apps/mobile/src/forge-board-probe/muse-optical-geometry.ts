/** Meter-space vector used by the calibrated optical helpers. */
export type OpticalVector = readonly [number, number, number];
/** Row-major proper rotation; camera axes are right, down, forward. */
export type OpticalRotation = readonly [number, number, number, number, number, number, number, number, number];
/** Pixel coordinates in the calibrated, undistorted image, not preview coordinates. */
export type OpticalPixel = readonly [number, number];
/** Explicit pinhole calibration consumed by {@link calibratedPixelRay}. No guessed FOV. */
export interface OpticalCamera {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly fx: number;
  readonly fy: number;
  readonly cx: number;
  readonly cy: number;
  readonly worldFromCamera: { readonly rotation: OpticalRotation; readonly translationMeters: OpticalVector };
  readonly pixels: 'undistorted';
}
/** A forward ray produced from measured pixels by {@link calibratedPixelRay}. */
export interface OpticalRay { readonly originMeters: OpticalVector; readonly direction: OpticalVector }
/** Known physical point and independently measured world point for {@link solveRigidOpticalPose}. */
export interface OpticalCorrespondence { readonly id: string; readonly physicalPointMeters: OpticalVector; readonly worldPointMeters: OpticalVector }
/** Model-to-world rigid transform accepted by {@link solveRigidOpticalPose}. */
export interface OpticalPose { readonly rotation: OpticalRotation; readonly translationMeters: OpticalVector; readonly maxResidualMeters: number }
const dot=(a:OpticalVector,b:OpticalVector)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a:OpticalVector,b:OpticalVector):OpticalVector=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:OpticalVector,b:OpticalVector):OpticalVector=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:OpticalVector,s:number):OpticalVector=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a:OpticalVector,b:OpticalVector):OpticalVector=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const validVector=(v:OpticalVector)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const unit=(v:OpticalVector):OpticalVector|null=>{const n=Math.hypot(...v);return validVector(v)&&Number.isFinite(n)&&n>1e-10?scale(v,1/n):null;};
const rotate=(r:OpticalRotation,v:OpticalVector):OpticalVector=>[r[0]*v[0]+r[1]*v[1]+r[2]*v[2],r[3]*v[0]+r[4]*v[1]+r[5]*v[2],r[6]*v[0]+r[7]*v[1]+r[8]*v[2]];
const transpose=(r:OpticalRotation):OpticalRotation=>[r[0],r[3],r[6],r[1],r[4],r[7],r[2],r[5],r[8]];
const positive=(v:number)=>Number.isFinite(v)&&v>0;
function validRotation(r:OpticalRotation):boolean {
  if(!Array.isArray(r)||r.length!==9||!r.every(Number.isFinite))return false;
  const a:OpticalVector=[r[0],r[1],r[2]],b:OpticalVector=[r[3],r[4],r[5]],c:OpticalVector=[r[6],r[7],r[8]];
  return [a,b,c].every(v=>Math.abs(dot(v,v)-1)<1e-6)&&Math.abs(dot(a,b))<1e-6&&Math.abs(dot(a,c))<1e-6&&Math.abs(dot(b,c))<1e-6&&Math.abs(dot(cross(a,b),c)-1)<1e-6;
}
function validCamera(c:OpticalCamera):boolean {
  return !!c&&c.pixels==='undistorted'&&typeof c.id==='string'&&c.id.length>0&&Number.isSafeInteger(c.width)&&c.width>0&&Number.isSafeInteger(c.height)&&c.height>0&&positive(c.fx)&&positive(c.fy)&&Number.isFinite(c.cx)&&Number.isFinite(c.cy)&&!!c.worldFromCamera&&validRotation(c.worldFromCamera.rotation)&&validVector(c.worldFromCamera.translationMeters);
}
const validPixel=(c:OpticalCamera,p:OpticalPixel)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<c.width&&p[1]>=0&&p[1]<c.height;
/** Back-project an already-undistorted measured image pixel; invalid calibration returns null.
 * Pinhole convention: https://docs.opencv.org/4.11.0/d9/d0c/group__calib3d.html
 */
export function calibratedPixelRay(options:{camera:OpticalCamera;pixel:OpticalPixel}):OpticalRay|null {
  const {camera:c,pixel:p}=options;if(!validCamera(c)||!validPixel(c,p))return null;
  const direction=unit(rotate(c.worldFromCamera.rotation,[(p[0]-c.cx)/c.fx,(p[1]-c.cy)/c.fy,1]));
  return direction?{originMeters:[...c.worldFromCamera.translationMeters],direction}:null;
}
/** Closest-point triangulation of two forward rays. Rejects parallel, behind-camera, or inconsistent rays. */
export function triangulateCalibratedRays(options:{first:OpticalRay;second:OpticalRay;maxRaySeparationMeters:number;minAngleRadians:number}):OpticalVector|null {
  const {first:a,second:b,maxRaySeparationMeters:limit,minAngleRadians:angle}=options;
  if(!positive(limit)||!positive(angle)||angle>=Math.PI/2||!validVector(a.originMeters)||!validVector(b.originMeters))return null;
  const u=unit(a.direction),v=unit(b.direction);if(!u||!v)return null;
  const cosine=dot(u,v),denominator=1-cosine*cosine;
  if(denominator<Math.sin(angle)**2)return null;
  const w=sub(a.originMeters,b.originMeters),d=dot(u,w),e=dot(v,w);
  const s=(cosine*e-d)/denominator,t=(e-cosine*d)/denominator;
  if(!positive(s)||!positive(t))return null;
  const p=add(a.originMeters,scale(u,s)),q=add(b.originMeters,scale(v,t));
  if(Math.hypot(...sub(p,q))>limit)return null;
  return scale(add(p,q),0.5);
}
/** Project a world point into the explicit calibrated image; rejects points behind the camera. */
export function projectOpticalPoint(options:{camera:OpticalCamera;pointMeters:OpticalVector}):OpticalPixel|null {
  const {camera:c,pointMeters:p}=options;if(!validCamera(c)||!validVector(p))return null;
  const q=rotate(transpose(c.worldFromCamera.rotation),sub(p,c.worldFromCamera.translationMeters));if(q[2]<=1e-10)return null;
  const pixel:OpticalPixel=[c.fx*q[0]/q[2]+c.cx,c.fy*q[1]/q[2]+c.cy];return pixel.every(Number.isFinite)?pixel:null;
}
/** Triangulate synchronized observations and require reprojection agreement in both cameras. */
export function triangulateOpticalPixels(options:{first:{camera:OpticalCamera;pixel:OpticalPixel};second:{camera:OpticalCamera;pixel:OpticalPixel};maxRaySeparationMeters:number;minAngleRadians:number;maxReprojectionPixels:number}):OpticalVector|null {
  if(options.first.camera.id===options.second.camera.id||!positive(options.maxReprojectionPixels))return null;
  const a=calibratedPixelRay(options.first),b=calibratedPixelRay(options.second);if(!a||!b)return null;
  const p=triangulateCalibratedRays({...options,first:a,second:b});if(!p)return null;
  for(const view of [options.first,options.second]){const q=projectOpticalPoint({camera:view.camera,pointMeters:p});if(!q||Math.hypot(q[0]-view.pixel[0],q[1]-view.pixel[1])>options.maxReprojectionPixels)return null;}
  return p;
}
function basis(a:OpticalVector,b:OpticalVector,c:OpticalVector):readonly[OpticalVector,OpticalVector,OpticalVector]|null {
  const x=unit(sub(b,a)),z=unit(cross(sub(b,a),sub(c,a)));if(!x||!z)return null;
  // Reject nearly collinear points, independently of physical scale.
  if(Math.hypot(...cross(sub(b,a),sub(c,a)))/(Math.hypot(...sub(b,a))*Math.hypot(...sub(c,a)))<1e-3)return null;
  return [x,cross(z,x),z];
}
/** Recover a proper rigid transform from at least three identified, noncollinear physical points.
 * Uses a maximum-area physical triad, then checks every correspondence. This is not a least-squares optimizer.
 * Physical geometry must come from independent measurement; a detected tip/line alone is insufficient.
 */
export function solveRigidOpticalPose(options:{correspondences:readonly OpticalCorrespondence[];maxResidualMeters:number}):OpticalPose|null {
  const points=options.correspondences;if(!positive(options.maxResidualMeters)||points.length<3||points.length>32||new Set(points.map(p=>p.id)).size!==points.length||points.some(p=>!p.id||!validVector(p.physicalPointMeters)||!validVector(p.worldPointMeters)))return null;
  let best:readonly[number,number,number]|null=null,area=0;
  for(let i=0;i<points.length-2;i++)for(let j=i+1;j<points.length-1;j++)for(let k=j+1;k<points.length;k++){
    const a=points[i]!,b=points[j]!,c=points[k]!;const n=Math.hypot(...cross(sub(b.physicalPointMeters,a.physicalPointMeters),sub(c.physicalPointMeters,a.physicalPointMeters)));if(n>area){area=n;best=[i,j,k];}
  }
  if(!best)return null;const [a,b,c]=best.map(i=>points[i]!) as [OpticalCorrespondence,OpticalCorrespondence,OpticalCorrespondence];
  const source=basis(a.physicalPointMeters,b.physicalPointMeters,c.physicalPointMeters),target=basis(a.worldPointMeters,b.worldPointMeters,c.worldPointMeters);if(!source||!target)return null;
  const values:number[]=[];for(let row=0;row<3;row++)for(let col=0;col<3;col++)values.push(target[0][row]!*source[0][col]!+target[1][row]!*source[1][col]!+target[2][row]!*source[2][col]!);
  const rotation=values as unknown as OpticalRotation;if(!validRotation(rotation))return null;
  const translationMeters=sub(a.worldPointMeters,rotate(rotation,a.physicalPointMeters));let maxResidualMeters=0;
  for(const p of points)maxResidualMeters=Math.max(maxResidualMeters,Math.hypot(...sub(add(rotate(rotation,p.physicalPointMeters),translationMeters),p.worldPointMeters)));
  return maxResidualMeters<=options.maxResidualMeters?{rotation,translationMeters,maxResidualMeters}:null;
}
