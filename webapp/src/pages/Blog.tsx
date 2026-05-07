import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { blogPosts } from "@/lib/blog-data";

export default function Blog() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">Blog</p>
          <h1 className="font-display text-4xl font-semibold text-foreground mb-3">Research & Insights</h1>
          <p className="text-muted-foreground text-lg">
            Deep analysis on on-chain intelligence, the Machine Payments Protocol, and Solana market structure.
          </p>
        </div>
      </section>

      <section className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-5">
          {blogPosts.map((post) => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="block group">
              <article className="card-surface rounded p-6 hover:border-mpp-amber/25 transition-colors">
                <div className="flex items-center gap-3 mb-3">
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
                <h2 className="text-foreground font-semibold text-lg mb-2 group-hover:text-mpp-amber transition-colors">
                  {post.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-1.5 text-mpp-amber text-xs font-mono">
                  Read article <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
