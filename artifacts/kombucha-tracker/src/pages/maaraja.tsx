import { Layout } from "@/components/Layout";

export default function MaarajaPage() {
  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-5rem)] lg:h-screen">
        <div className="px-6 pt-6 pb-3 flex-shrink-0">
          <h1 className="text-3xl font-serif font-semibold">Määraja</h1>
          <p className="text-muted-foreground text-sm mt-1">What should I do with my kombucha today?</p>
        </div>
        <div className="flex-1 px-6 pb-6 lg:pb-6">
          <iframe
            src="https://kombucham2raja.lovable.app/"
            title="Kombucha Määraja"
            className="w-full h-full rounded-2xl border border-border"
            allow="fullscreen"
          />
        </div>
      </div>
    </Layout>
  );
}
