declare global {
  namespace App {
    interface PageData {
      seo?: import('$lib/seo').SeoMetadata;
    }
  }
}

export {};
