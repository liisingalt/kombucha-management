--
-- PostgreSQL database dump
--

\restrict gABI2aAxirETb7Sq6PIOsmzC5BpJ0OwcYW0RuxQAByQKQbp92QcJqecNspf3zCw

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batches (
    id integer NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    tea_type text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batches_id_seq OWNED BY public.batches.id;


--
-- Name: bottle_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bottle_tests (
    id integer NOT NULL,
    user_id text NOT NULL,
    product text NOT NULL,
    bottle_id text NOT NULL,
    bottled_date timestamp without time zone NOT NULL,
    interval_months integer NOT NULL,
    next_tasting timestamp without time zone NOT NULL,
    status text DEFAULT 'ootab'::text NOT NULL,
    result text,
    conclusion text,
    tasted_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bottle_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bottle_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bottle_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bottle_tests_id_seq OWNED BY public.bottle_tests.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    batch_id integer NOT NULL,
    day_number integer NOT NULL,
    temperature real,
    scobylook text,
    smell text,
    color text,
    notes text,
    ai_tip text,
    logged_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    taste text[],
    carbonation text,
    ph real,
    activities text[],
    flavour_additions text[]
);


--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logs_id_seq OWNED BY public.logs.id;


--
-- Name: persona_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persona_materials (
    id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    source_url text,
    type text DEFAULT 'manual'::text NOT NULL
);


--
-- Name: persona_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.persona_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: persona_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.persona_materials_id_seq OWNED BY public.persona_materials.id;


--
-- Name: photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photos (
    id integer NOT NULL,
    batch_id integer NOT NULL,
    object_path text NOT NULL,
    caption text,
    day_number integer,
    ai_analysis text,
    taken_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.photos_id_seq OWNED BY public.photos.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id integer NOT NULL,
    clerk_user_id text NOT NULL,
    has_completed_onboarding boolean DEFAULT false NOT NULL,
    has_made_before boolean DEFAULT false NOT NULL,
    has_scoby boolean DEFAULT false NOT NULL,
    current_stage text,
    experience_level text,
    flavor_preference text,
    onboarding_advice text,
    tts_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profiles_id_seq OWNED BY public.profiles.id;


--
-- Name: scoby_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scoby_conditions (
    id integer NOT NULL,
    image_url text NOT NULL,
    is_ok boolean NOT NULL,
    ok_reason text,
    not_ok_reason text,
    what_to_do text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: scoby_conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scoby_conditions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scoby_conditions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scoby_conditions_id_seq OWNED BY public.scoby_conditions.id;


--
-- Name: batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches ALTER COLUMN id SET DEFAULT nextval('public.batches_id_seq'::regclass);


--
-- Name: bottle_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bottle_tests ALTER COLUMN id SET DEFAULT nextval('public.bottle_tests_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs ALTER COLUMN id SET DEFAULT nextval('public.logs_id_seq'::regclass);


--
-- Name: persona_materials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_materials ALTER COLUMN id SET DEFAULT nextval('public.persona_materials_id_seq'::regclass);


--
-- Name: photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos ALTER COLUMN id SET DEFAULT nextval('public.photos_id_seq'::regclass);


--
-- Name: profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles ALTER COLUMN id SET DEFAULT nextval('public.profiles_id_seq'::regclass);


--
-- Name: scoby_conditions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoby_conditions ALTER COLUMN id SET DEFAULT nextval('public.scoby_conditions_id_seq'::regclass);


--
-- Data for Name: batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.batches (id, user_id, name, started_at, status, tea_type, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bottle_tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bottle_tests (id, user_id, product, bottle_id, bottled_date, interval_months, next_tasting, status, result, conclusion, tasted_date, created_at) FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, user_id, role, content, created_at) FROM stdin;
1	user_3C3xWng5QWrPeV6nIhIVDn5ItLc	user	vbjii	2026-04-08 06:08:06.310985
2	user_3C3xWng5QWrPeV6nIhIVDn5ItLc	assistant	I’m not sure what “vbjii” refers to. Did you mean:\n\n- **F1** (first fermentation) or **F2** (bottle fermentation)?\n- A **brand**/ingredient name?\n- Or was it a typo?\n\nTell me what you’re trying to do (start a batch, troubleshoot, flavoring, carbonation, mold check, etc.) and what your setup is (jar size, tea type, sugar amount, temperature), and I’ll help you quickly.	2026-04-08 06:08:06.310985
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.logs (id, batch_id, day_number, temperature, scobylook, smell, color, notes, ai_tip, logged_at, created_at, taste, carbonation, ph, activities, flavour_additions) FROM stdin;
\.


--
-- Data for Name: persona_materials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.persona_materials (id, title, content, created_at, source_url, type) FROM stdin;
\.


--
-- Data for Name: photos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.photos (id, batch_id, object_path, caption, day_number, ai_analysis, taken_at, created_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, clerk_user_id, has_completed_onboarding, has_made_before, has_scoby, current_stage, experience_level, flavor_preference, onboarding_advice, tts_enabled, created_at, updated_at) FROM stdin;
1	user_3C3xWng5QWrPeV6nIhIVDn5ItLc	t	t	f	First fermentation	Intermediate	\N	Since you’ve brewed before and you’re already in 1F without a SCOBY on hand, your immediate priority is keeping the brew safely acidic: use *plenty* of strong starter (ideally 10–20% of your total volume, from raw/unflavored kombucha) and keep the vessel warm and undisturbed so a new pellicle can form on its own. Watch the surface over the next few days—patchy bubbles and a thin, translucent film are normal early signs; fuzzy/dry spots or blue/green/black growth is a stop-and-toss. Taste daily once it starts smelling tangy: when it hits a balance you like (usually mildly sweet to pleasantly tart), strain into bottles for 2F and save a good cup or two as starter for your next batch. You’re in a great spot—an intermediate brewer’s instincts plus careful starter/temperature control will get you a healthy culture again quickly.	t	2026-04-08 06:01:32.065587	2026-04-08 06:02:32.585
\.


--
-- Data for Name: scoby_conditions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scoby_conditions (id, image_url, is_ok, ok_reason, not_ok_reason, what_to_do, created_at) FROM stdin;
\.


--
-- Name: batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.batches_id_seq', 1, false);


--
-- Name: bottle_tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bottle_tests_id_seq', 1, false);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 2, true);


--
-- Name: logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.logs_id_seq', 1, false);


--
-- Name: persona_materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.persona_materials_id_seq', 1, false);


--
-- Name: photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.photos_id_seq', 1, false);


--
-- Name: profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.profiles_id_seq', 1, true);


--
-- Name: scoby_conditions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.scoby_conditions_id_seq', 1, false);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: bottle_tests bottle_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bottle_tests
    ADD CONSTRAINT bottle_tests_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: persona_materials persona_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persona_materials
    ADD CONSTRAINT persona_materials_pkey PRIMARY KEY (id);


--
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_clerk_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_clerk_user_id_unique UNIQUE (clerk_user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: scoby_conditions scoby_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scoby_conditions
    ADD CONSTRAINT scoby_conditions_pkey PRIMARY KEY (id);


--
-- Name: logs logs_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: photos photos_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict gABI2aAxirETb7Sq6PIOsmzC5BpJ0OwcYW0RuxQAByQKQbp92QcJqecNspf3zCw

