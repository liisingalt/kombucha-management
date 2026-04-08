import { useParams, useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChipSelector } from "@/components/ChipSelector";
import { useCreateLog, getListLogsQueryKey, getGetBatchQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const schema = z.object({
  dayNumber: z.coerce.number().min(1, "Day number required"),
  temperature: z.string().optional(),
  ph: z.string().optional(),
  taste: z.array(z.string()).optional(),
  carbonation: z.string().optional(),
  activities: z.array(z.string()).optional(),
  smell: z.string().optional(),
  flavourAdditions: z.array(z.string()).optional(),
  scobylook: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const tasteOptions = [
  { value: "sweet", label: "Sweet" },
  { value: "tart", label: "Tart" },
  { value: "sour", label: "Sour" },
  { value: "vinegary", label: "Vinegary" },
  { value: "mild", label: "Mild" },
  { value: "fruity", label: "Fruity" },
  { value: "fizzy", label: "Fizzy" },
  { value: "flat", label: "Flat" },
];

const carbonationOptions = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

const activityOptions = [
  { value: "tasted", label: "Tasted" },
  { value: "stirred", label: "Stirred" },
  { value: "skimmed", label: "Skimmed" },
  { value: "added_tea", label: "Added tea" },
  { value: "added_sugar", label: "Added sugar" },
  { value: "moved", label: "Moved vessel" },
  { value: "bottled", label: "Bottled" },
  { value: "checked_ph", label: "Checked pH" },
];

const smellOptions = [
  { value: "good", label: "Good" },
  { value: "sweet", label: "Sweet" },
  { value: "sour", label: "Sour" },
  { value: "vinegary", label: "Vinegary" },
  { value: "yeasty", label: "Yeasty" },
  { value: "strange", label: "Strange" },
];

const flavourAdditionOptions = [
  { value: "ginger", label: "Ginger" },
  { value: "lemon", label: "Lemon" },
  { value: "raspberry", label: "Raspberry" },
  { value: "blueberry", label: "Blueberry" },
  { value: "mango", label: "Mango" },
  { value: "apple", label: "Apple" },
  { value: "mint", label: "Mint" },
  { value: "hibiscus", label: "Hibiscus" },
  { value: "turmeric", label: "Turmeric" },
  { value: "cinnamon", label: "Cinnamon" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-1">
      {children}
    </p>
  );
}

export default function CreateLogPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const batchIdNum = parseInt(batchId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createLog = useCreateLog();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dayNumber: 1,
      temperature: "",
      ph: "",
      taste: [],
      carbonation: "",
      activities: [],
      smell: "",
      flavourAdditions: [],
      scobylook: "",
      color: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createLog.mutateAsync({
        batchId: batchIdNum,
        data: {
          dayNumber: values.dayNumber,
          temperature: values.temperature ? parseFloat(values.temperature) : undefined,
          ph: values.ph ? parseFloat(values.ph) : undefined,
          taste: values.taste && values.taste.length > 0 ? values.taste : undefined,
          carbonation: values.carbonation || undefined,
          activities: values.activities && values.activities.length > 0 ? values.activities : undefined,
          smell: values.smell || undefined,
          flavourAdditions: values.flavourAdditions && values.flavourAdditions.length > 0 ? values.flavourAdditions : undefined,
          scobylook: values.scobylook || undefined,
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
          <Link
            href={`/batches/${batchIdNum}`}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl font-serif font-semibold">Daily log</h1>
            <p className="text-muted-foreground text-sm mt-1">Record today's observations</p>
          </div>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Temperature & pH */}
                <div>
                  <SectionHeading>Temperature &amp; pH</SectionHeading>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="ph"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>pH</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-ph"
                              type="number"
                              step="0.1"
                              min="0"
                              max="14"
                              placeholder="e.g. 3.2"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Taste */}
                <div>
                  <SectionHeading>Taste</SectionHeading>
                  <Controller
                    control={form.control}
                    name="taste"
                    render={({ field }) => (
                      <ChipSelector
                        options={tasteOptions}
                        value={field.value ?? []}
                        onChange={(val) => field.onChange(val)}
                        multi
                      />
                    )}
                  />
                </div>

                {/* Carbonation */}
                <div>
                  <SectionHeading>Carbonation</SectionHeading>
                  <Controller
                    control={form.control}
                    name="carbonation"
                    render={({ field }) => (
                      <ChipSelector
                        options={carbonationOptions}
                        value={field.value ?? ""}
                        onChange={(val) => field.onChange(val)}
                      />
                    )}
                  />
                </div>

                {/* Activities */}
                <div>
                  <SectionHeading>Activities performed</SectionHeading>
                  <Controller
                    control={form.control}
                    name="activities"
                    render={({ field }) => (
                      <ChipSelector
                        options={activityOptions}
                        value={field.value ?? []}
                        onChange={(val) => field.onChange(val)}
                        multi
                      />
                    )}
                  />
                </div>

                {/* Smell */}
                <div>
                  <SectionHeading>Smell</SectionHeading>
                  <Controller
                    control={form.control}
                    name="smell"
                    render={({ field }) => (
                      <ChipSelector
                        options={smellOptions}
                        value={field.value ?? ""}
                        onChange={(val) => field.onChange(val)}
                      />
                    )}
                  />
                </div>

                {/* Flavour additions */}
                <div>
                  <SectionHeading>Flavour additions</SectionHeading>
                  <Controller
                    control={form.control}
                    name="flavourAdditions"
                    render={({ field }) => (
                      <ChipSelector
                        options={flavourAdditionOptions}
                        value={field.value ?? []}
                        onChange={(val) => field.onChange(val)}
                        multi
                      />
                    )}
                  />
                </div>

                {/* SCOBY & Colour */}
                <div>
                  <SectionHeading>SCOBY &amp; Colour</SectionHeading>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Colour</FormLabel>
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
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <SectionHeading>Notes</SectionHeading>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
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
                </div>

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
