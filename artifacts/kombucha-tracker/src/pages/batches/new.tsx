import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateBatch, getListBatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

function todayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const schema = z.object({
  name: z.string().min(1, "Batch name is required"),
  startedAt: z.string().min(1, "Start date is required"),
  teaType: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const teaTypes = ["Black tea", "Green tea", "White tea", "Oolong tea", "Herbal blend", "Other"];

export default function NewBatchPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createBatch = useCreateBatch();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", startedAt: todayDateString(), teaType: "", notes: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const batch = await createBatch.mutateAsync({
        data: {
          name: values.name,
          startedAt: new Date(values.startedAt),
          teaType: values.teaType || undefined,
          notes: values.notes || undefined,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() });
      setLocation(`/batches/${batch.id}`);
    } catch {
      toast({ title: "Could not create batch", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/batches"
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl font-serif font-semibold">New batch</h1>
            <p className="text-muted-foreground text-sm mt-1">Start a new fermentation run</p>
          </div>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch name</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-batch-name"
                          placeholder="e.g. Summer Ginger Brew"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tee peale läks (Päev 0)</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-started-at"
                          type="date"
                          max={todayDateString()}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teaType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tea type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tea-type">
                            <SelectValue placeholder="Select tea type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teaTypes.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-notes"
                          placeholder="Any starting notes about this batch..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  data-testid="button-create-batch"
                  type="submit"
                  className="w-full"
                  disabled={createBatch.isPending}
                >
                  {createBatch.isPending ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Creating...</>
                  ) : (
                    "Start batch"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
