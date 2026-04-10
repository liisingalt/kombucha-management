import { useParams, useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChipSelector } from "@/components/ChipSelector";
import { useCreateLog, getListLogsQueryKey, getGetBatchQueryKey, useListBatches } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { useMemo, useEffect } from "react";

function todayDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeDayNumber(startedAt: string, logDate: string): number {
  const start = new Date(startedAt);
  start.setHours(0, 0, 0, 0);
  const log = new Date(logDate + "T00:00:00");
  const diffMs = log.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

const schema = z.object({
  logDate: z.string().min(1, "Date required"),
  selectedBatchId: z.string().min(1, "Batch required"),
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

  const { data: batches = [] } = useListBatches();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      logDate: todayDateString(),
      selectedBatchId: isNaN(batchIdNum) ? "" : String(batchIdNum),
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

  useEffect(() => {
    if (batches.length === 0) return;
    const currentValue = form.getValues("selectedBatchId");
    if (currentValue && batches.some((b) => String(b.id) === currentValue)) return;
    const activeBatches = batches.filter((b) => b.status === "active");
    const fallback = activeBatches.length > 0 ? activeBatches[0] : batches[0];
    if (fallback) {
      form.setValue("selectedBatchId", String(fallback.id));
    }
  }, [batches, form]);

  const watchedBatchId = form.watch("selectedBatchId");
  const watchedLogDate = form.watch("logDate");

  const selectedBatch = useMemo(
    () => batches.find((b) => String(b.id) === watchedBatchId),
    [batches, watchedBatchId]
  );

  const derivedDayNumber = useMemo(() => {
    if (!selectedBatch || !watchedLogDate) return null;
    return computeDayNumber(selectedBatch.startedAt, watchedLogDate);
  }, [selectedBatch, watchedLogDate]);

  const onSubmit = async (values: FormValues) => {
    const targetBatchId = parseInt(values.selectedBatchId);
    if (isNaN(targetBatchId)) {
      toast({ title: "Please select a batch", variant: "destructive" });
      return;
    }

    const dayNumber = derivedDayNumber ?? 1;
    const loggedAt = new Date(values.logDate + "T12:00:00");

    try {
      await createLog.mutateAsync({
        batchId: targetBatchId,
        data: {
          dayNumber,
          loggedAt,
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
      queryClient.invalidateQueries({ queryKey: getListLogsQueryKey(targetBatchId) });
      queryClient.invalidateQueries({ queryKey: getGetBatchQueryKey(targetBatchId) });
      toast({ title: "Log saved" });
      setLocation(`/batches/${targetBatchId}`);
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

                {/* Batch & Date */}
                <div>
                  <SectionHeading>Batch &amp; Date</SectionHeading>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="selectedBatchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Batch</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-batch">
                                <SelectValue placeholder="Select a batch…" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {batches.map((batch) => (
                                <SelectItem key={batch.id} value={String(batch.id)}>
                                  {batch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="logDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-log-date"
                                type="date"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <Label className="text-sm font-medium">Day number</Label>
                        <div
                          data-testid="display-day-number"
                          className="mt-2 flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                        >
                          {derivedDayNumber !== null ? `Day ${derivedDayNumber}` : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Temperature & pH */}
                <div>
                  <SectionHeading>Temperature &amp; pH</SectionHeading>
                  <div className="grid grid-cols-2 gap-4">
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
