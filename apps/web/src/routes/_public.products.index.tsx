import { createFileRoute } from "@tanstack/react-router";
import { PublicCatalogPage } from "../pages/PublicPages";

export const Route = createFileRoute("/_public/products/")({ component: PublicCatalogPage });
