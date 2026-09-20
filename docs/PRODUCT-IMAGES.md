# Product images

Product images are optional. The frontend uploads JPG, PNG, or WebP files up
to 5 MB to the Supabase Storage bucket `product-images` and stores the public
URL on the PostgreSQL product row.

The object path is:

```text
{category-slug}/{generated-file-id}.{extension}
```

Create a public-read bucket named `product-images` in Supabase Storage. Upload
access must be restricted to authenticated users by the bucket policies. The
publishable Supabase key is safe for browser use; never put a service-role key
in `.env.local` or frontend code.

The database migration is `000021_product_images.sql`. Apply it before using
the image field in the Go API.
