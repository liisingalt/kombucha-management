import { Link } from "wouter";
import { Droplets, Leaf, FlaskConical, Package } from "lucide-react";
import { Layout } from "@/components/Layout";

const actions = [
  {
    href: "/kaarimine",
    label: "Lisa käärimine",
    description: "Uus käärimispartii",
    icon: Droplets,
    color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
    iconColor: "text-blue-500",
  },
  {
    href: "/maitsestamine",
    label: "Lisa maitsestamine",
    description: "Uus maitsestamine",
    icon: Leaf,
    color: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
    iconColor: "text-green-500",
  },
  {
    href: "/valmistamine",
    label: "Lisa tee",
    description: "Uus pruulimine / tee varu",
    icon: FlaskConical,
    color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
    iconColor: "text-amber-500",
  },
  {
    href: "/ladu",
    label: "Halda ladu",
    description: "Villimine ja laohaldus",
    icon: Package,
    color: "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100",
    iconColor: "text-stone-500",
  },
];

export default function TootminePage() {
  return (
    <Layout>
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-stone-900 mb-1 mt-2">Tootmine</h1>
        <p className="text-sm text-stone-400 mb-6">Vali toiming</p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map(({ href, label, description, icon: Icon, color, iconColor }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${color}`}
            >
              <div className={`p-2 rounded-xl bg-white/60 ${iconColor}`}>
                <Icon size={26} strokeWidth={1.8} />
              </div>
              <div>
                <div className="font-semibold text-sm leading-tight">{label}</div>
                <div className="text-xs opacity-70 mt-0.5">{description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
