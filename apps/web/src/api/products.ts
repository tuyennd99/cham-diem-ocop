import { API } from "../constants/api";
import type { CategoryRecord } from "../types/product";
import type { PublicProduct, PublicProductParams } from "../types/public";
import { requestJson } from "./base-request";

export const productsApi = {
  categories: () => requestJson<CategoryRecord[]>({ url: API.categories }),
  list: <T = PublicProduct>(params: PublicProductParams) =>
    requestJson<T[]>({ url: API.products.list, params }),
  detail: <T = PublicProduct>(id: string) => requestJson<T>({ url: API.products.detail(id) }),
};
