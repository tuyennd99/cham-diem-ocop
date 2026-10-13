import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "../pages/AuthPages";

export const Route = createFileRoute("/_auth/register")({ component: RegisterPage });
