type D68CatchHandler<TResult> = ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined;

declare module '@supabase/postgrest-js' {
  interface PostgrestBuilder<Result> {
    catch<TResult = never>(onrejected?: D68CatchHandler<TResult>): PromiseLike<Result | TResult>;
  }

  interface PostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships> {
    catch<TResult = never>(onrejected?: D68CatchHandler<TResult>): PromiseLike<Result | TResult>;
  }
}

declare global {
  interface PromiseLike<T> {
    catch<TResult = never>(onrejected?: D68CatchHandler<TResult>): PromiseLike<T | TResult>;
  }
}

export {};
