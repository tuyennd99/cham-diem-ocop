import { createFileRoute } from "@tanstack/react-router";
import { PublicCatalogPage } from "../pages/public/PublicCatalogPage";

export const Route = createFileRoute("/_public/products/")({ component: PublicCatalogPage });
