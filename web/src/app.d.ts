declare global {
  namespace App {
    interface Locals {
      cascadeEdition: import('$lib/cascade/config').CascadeEdition;
    }

    interface PageData {
      cascadeEdition?: import('$lib/cascade/config').CascadeEdition;
      cascadeRuntime?: import('$lib/cascade/config').CascadeClientRuntime;
      seo?: import('$lib/seo').SeoMetadata;
    }
  }
}

export {};
