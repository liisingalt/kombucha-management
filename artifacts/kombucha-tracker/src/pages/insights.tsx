import { Layout } from "@/components/Layout";
import { Sparkles, PlayCircle, Clock, BookOpen, ChevronRight, Star, Droplets, Thermometer, FlaskConical } from "lucide-react";

const tipOfTheDay = {
  title: "Today's brew tip",
  text: "Keep your SCOBY at 24–29°C for optimal fermentation. Too cold slows the process; too hot can damage your culture.",
  tag: "Temperature",
};

const articles = [
  {
    id: 1,
    title: "How to read your SCOBY's health signals",
    category: "SCOBY care",
    color: "bg-amber-50",
    icon: Droplets,
    iconColor: "text-amber-600",
    readTime: "4 min",
  },
  {
    id: 2,
    title: "The science of kombucha pH and acidity",
    category: "Fermentation",
    color: "bg-stone-50",
    icon: FlaskConical,
    iconColor: "text-stone-600",
    readTime: "6 min",
  },
  {
    id: 3,
    title: "Choosing the right tea for your brew",
    category: "Ingredients",
    color: "bg-green-50",
    icon: BookOpen,
    iconColor: "text-green-700",
    readTime: "3 min",
  },
  {
    id: 4,
    title: "Second fermentation: tips for perfect bubbles",
    category: "F2",
    color: "bg-orange-50",
    icon: Sparkles,
    iconColor: "text-orange-600",
    readTime: "5 min",
  },
  {
    id: 5,
    title: "Troubleshooting mold vs. healthy yeast strands",
    category: "Troubleshooting",
    color: "bg-red-50",
    icon: Star,
    iconColor: "text-red-600",
    readTime: "7 min",
  },
  {
    id: 6,
    title: "Seasonal brewing: adjusting for temperature swings",
    category: "Advanced",
    color: "bg-blue-50",
    icon: Thermometer,
    iconColor: "text-blue-600",
    readTime: "4 min",
  },
];

const videos = [
  {
    id: 1,
    title: "Kombucha basics: your first brew start to finish",
    duration: "18 min",
    level: "Beginner",
    color: "from-amber-400 to-orange-400",
    emoji: "🍵",
  },
  {
    id: 2,
    title: "SCOBY hotel: how to store and grow your culture",
    duration: "12 min",
    level: "Intermediate",
    color: "from-stone-400 to-amber-500",
    emoji: "🫙",
  },
  {
    id: 3,
    title: "Flavoring masterclass: fruits, herbs and spices",
    duration: "24 min",
    level: "All levels",
    color: "from-green-400 to-teal-500",
    emoji: "🌿",
  },
];

const recommendations = [
  {
    id: 1,
    name: "Glass fermentation jar (1 gallon)",
    note: "Wide-mouth, with a breathable cloth lid",
    emoji: "🫙",
    tag: "Equipment",
  },
  {
    id: 2,
    name: "pH test strips",
    note: "Range 2.5–4.5 ideal for monitoring acidity",
    emoji: "🧪",
    tag: "Testing",
  },
  {
    id: 3,
    name: "Organic black tea bags",
    note: "No oils or flavourings — plain teas work best",
    emoji: "🍃",
    tag: "Ingredients",
  },
];

export default function InsightsPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="px-5 pt-6 pb-3">
          <h1 className="text-2xl font-serif font-bold text-foreground">Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tips, guides and courses for your brew</p>
        </div>

        {/* Tip of the day */}
        <div className="px-5 mb-6">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="opacity-80" />
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{tipOfTheDay.title}</span>
            </div>
            <p className="text-sm font-medium leading-relaxed mb-3">{tipOfTheDay.text}</p>
            <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-white/20 font-medium">
              {tipOfTheDay.tag}
            </span>
          </div>
        </div>

        {/* Articles */}
        <section className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-base font-serif font-semibold text-foreground">Articles</h2>
            <button className="text-xs text-primary font-medium flex items-center gap-0.5">
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide snap-x snap-mandatory">
            {articles.map((article) => {
              const Icon = article.icon;
              return (
                <div
                  key={article.id}
                  className={`flex-none w-48 rounded-2xl ${article.color} p-4 snap-start cursor-pointer hover:shadow-sm transition-shadow`}
                >
                  <div className={`w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center mb-3`}>
                    <Icon size={18} className={article.iconColor} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {article.category}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground leading-snug mt-1 mb-3 line-clamp-3">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock size={11} />
                    <span className="text-[11px]">{article.readTime} read</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Video courses */}
        <section className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-base font-serif font-semibold text-foreground">Video courses</h2>
            <button className="text-xs text-primary font-medium flex items-center gap-0.5">
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide snap-x snap-mandatory">
            {videos.map((video) => (
              <div
                key={video.id}
                className="flex-none w-56 rounded-2xl bg-card border border-border overflow-hidden snap-start cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className={`h-28 bg-gradient-to-br ${video.color} flex items-center justify-center relative`}>
                  <span className="text-4xl">{video.emoji}</span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center backdrop-blur-sm">
                      <PlayCircle size={22} className="text-white" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {video.level}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-2">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock size={11} />
                    <span className="text-[11px]">{video.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recommendations */}
        <section className="mb-8">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-base font-serif font-semibold text-foreground">Recommendations</h2>
            <button className="text-xs text-primary font-medium flex items-center gap-0.5">
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="px-5 space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-2xl">
                  {rec.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{rec.name}</h3>
                    <span className="flex-none text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground font-medium">
                      {rec.tag}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{rec.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
