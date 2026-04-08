import { useParams, useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateLog, getListLogsQueryKey, getGetBatchQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const schema = z.object({
  dayNumber: z.coerce.number().min(1, "Day number required"),
  temperature: z.string().optional(),
  scobylook: z.string().optional(),
  smell: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const smellOptions = [
  { value: "good", label: "Good - slightly sweet/vinegary" },
  { value: "sour", label: "Sour - strong acidity" },
  { value: "vinegary", label: "Vinegary - over-fermented" },
  { value: "strange", label: "Strange - unusual odor" },
];

export default function CreateLogPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const batchIdNum = parseInt(batchId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createLog = useCreateLog();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dayNumber: 1, temperature: "", scobylook: "", smell: "", color: "", notes: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createLog.mutateAsync({
        batchId: batchIdNum,
        data: {
          dayNumber: values.dayNumber,
          temperature: values.temperature ? parseFloat(values.temperature) : undefined,
          scobylook: values.scobylook || undefined,
          smell: values.smell || undefined,
          color: values.color || undefined,
          notes: values.notes || undefined,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListLogsQueryKey(batchIdNum) });
      queryClient.invalidateQueries({ queryKey: getGetBatchQueryKey(batchIdNum) });
      toast({ title: "Log saved" });
      setLocation(`/batches/${batchIdNum}`);
    } catch {
      toast({ title: "Could not save log", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/batches/${batchIdNum}`}>
            <a className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </a>
          </Link>
          <div>
            <h1 className="text-3xl font-serif font-semibold">Daily log</h1>
            <p className="text-muted-foreground text-sm mt-1">Record today's observations</p>
          </div>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="dayNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day number</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-day-number"
                          type="number"
                          min={1}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature (°C)</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-temperature"
                          type="number"
                          step="0.1"
                          placeholder="e.g. 22.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smell"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Smell</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-smell">
                            <SelectValue placeholder="How does it smell?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {smellOptions.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-color"
                          placeholder="e.g. light amber, golden yellow"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scobylook"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SCOBY appearance</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-scoby-look"
                          placeholder="Describe what the SCOBY looks like..."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="textarea-log-notes"
                          placeholder="Any other observations..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  data-testid="button-save-log"
                  type="submit"
                  className="w-full"
                  disabled={createLog.isPending}
                >
                  {createLog.isPending ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</>
                  ) : (
                    "Save log"
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
