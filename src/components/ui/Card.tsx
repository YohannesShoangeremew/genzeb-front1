import { HTMLAttributes } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["glass rounded-2xl p-3.5", className].join(" ")}
      {...rest}
    />
  );
}
