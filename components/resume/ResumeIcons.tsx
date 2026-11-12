import { Svg, Path, Rect, Circle, G as SvgG } from "@react-pdf/renderer";
import type { IconKind } from "@/lib/resume/engine/types";

type P = { w: number; h: number; color: string };

function Pin({ w, h, color }: P) {
  return (
    <Svg width={w} height={h} viewBox="0 0 14 18">
      <Path
        d="M7 0C3.1 0 0 3.1 0 7c0 5.1 7 11 7 11s7-5.9 7-11c0-3.9-3.1-7-7-7zm0 9.6a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2z"
        fill={color}
      />
    </Svg>
  );
}

function Mail({ w, h, color }: P) {
  return (
    <Svg width={w} height={h} viewBox="0 0 16 12">
      <Path d="M0 1.2C0 .5.5 0 1.2 0h13.6C15.5 0 16 .5 16 1.2v.4L8 6.6 0 1.6v-.4z" fill={color} />
      <Path d="M0 3.4l8 5 8-5v7.4c0 .7-.5 1.2-1.2 1.2H1.2C.5 12 0 11.5 0 10.8V3.4z" fill={color} />
    </Svg>
  );
}

function Chain({ w, h, color }: P) {
  return (
    <Svg width={w} height={h} viewBox="0 0 24 24">
      <SvgG transform="rotate(-45 12 12)">
        <Rect x={1.5} y={8} width={12} height={8} rx={4} fill="none" stroke={color} strokeWidth={2.2} />
        <Rect x={10.5} y={8} width={12} height={8} rx={4} fill="none" stroke={color} strokeWidth={2.2} />
      </SvgG>
    </Svg>
  );
}

function LinkedIn({ w, h, color }: P) {
  return (
    <Svg width={w} height={h} viewBox="0 0 16 16">
      <Rect x={0} y={0} width={16} height={16} rx={2.2} fill={color} />
      <Rect x={2.6} y={6} width={2.4} height={7.4} fill="#fff" />
      <Circle cx={3.8} cy={3.7} r={1.4} fill="#fff" />
      <Path
        d="M6.9 6h2.3v1c.4-.7 1.2-1.2 2.3-1.2 2.1 0 2.9 1.3 2.9 3.4v4.2h-2.4v-3.7c0-.9-.3-1.5-1.1-1.5-.9 0-1.4.6-1.4 1.6v3.6H6.9V6z"
        fill="#fff"
      />
    </Svg>
  );
}

function Github({ w, h, color }: P) {
  return (
    <Svg width={w} height={h} viewBox="0 0 16 16">
      <Path
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        fill={color}
      />
    </Svg>
  );
}

export function ResumeIcon({ kind, w, h, color }: { kind: IconKind } & P) {
  switch (kind) {
    case "pin":
      return <Pin w={w} h={h} color={color} />;
    case "mail":
      return <Mail w={w} h={h} color={color} />;
    case "chain":
      return <Chain w={w} h={h} color={color} />;
    case "linkedin":
      return <LinkedIn w={w} h={h} color={color} />;
    case "github":
      return <Github w={w} h={h} color={color} />;
  }
}
