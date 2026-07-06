import '@supabase/postgrest-js';

declare module '@supabase/postgrest-js' {
  interface PostgrestBuilder<Result> {
    catch<TResult = never>(
      onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
    ): Promise<Result | TResult>;
  }
}
