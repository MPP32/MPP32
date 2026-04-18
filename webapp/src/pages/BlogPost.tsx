import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { blogPosts } from "@/lib/blog-data";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-mpp-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground font-mono text-sm mb-4">Post not found</p>
          <Link to="/blog" className="text-mpp-amber font-mono text-sm hover:underline">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const sections = post.content.split("\n\n");

  function renderSection(text: string, i: number) {
    if (text.startsWith("## ")) {
      return (
        <h2 key={i} className="font-display text-2xl font-semibold text-foreground mt-10 mb-4">
          {text.slice(3)}
        </h2>
      );
    }
    if (text.startsWith("**") && text.endsWith("**") && !text.slice(2).includes("**")) {
      return (
        <p key={i} className="font-semibold text-foreground mt-6 mb-2">
          {text.slice(2, -2)}
        </p>
      );
    }
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-muted-foreground text-base leading-relaxed">
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-mpp-bg">
      <div className="border-b border-mpp-border bg-mpp-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-mpp-amber text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center flex-wrap gap-3 mb-6">
          <span className="px-2 py-0.5 rounded border border-mpp-border text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
            {post.category}
          </span>
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {post.readTime}
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground leading-tight mb-5">
          {post.title}
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed border-l-2 border-mpp-amber pl-4 mb-10">
          {post.excerpt}
        </p>

        <div className="border-t border-mpp-border mb-10" />

        <div className="space-y-4">
          {sections.map((section, i) => renderSection(section, i))}
        </div>

        <div className="mt-16 pt-8 border-t border-mpp-border flex items-center justify-between gap-4 flex-wrap">
          <Link to="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-mpp-amber text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Articles
          </Link>
          <Link to="/playground">
            <button className="btn-amber flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold">
              Try the Playground
            </button>
          </Link>
        </div>
      </article>
    </div>
  );
}
