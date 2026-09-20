"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="section narrow">
      <h1>The store needs a moment.</h1>
      <p>Please try again. Your saved bag is stored separately.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
