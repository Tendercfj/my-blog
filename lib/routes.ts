export const routes = {
  home: "/",
  archives: "/archives",
  tags: "/tags",
  tag: (slug: string) => `/tags/${slug}`,
  categories: "/categories",
  category: (slug: string) => `/categories/${slug}`,
  about: "/about",
  login: "/login",
  account: "/account",
  accountPostEdit: (id: string) => `/account/posts/${id}/edit`,
  post: (slug: string) => `/posts/${slug}`,
} as const;
