import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | null;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;
