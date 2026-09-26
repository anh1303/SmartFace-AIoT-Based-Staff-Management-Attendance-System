--
-- PostgreSQL database dump
--

\restrict dHclnG07jXSm4t0uUXaihpam8z2B9hfDqrbKs5oIprvCr2wImeyXaZ5xQ02US6V

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: attendance_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_logs (
    id bigint NOT NULL,
    employee_id uuid NOT NULL,
    event_time timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type character varying(20) NOT NULL,
    method character varying(20) DEFAULT 'FACE'::character varying NOT NULL,
    device_info character varying(100),
    verification_score double precision,
    liveness_score double precision,
    status character varying(30) DEFAULT 'VALID'::character varying NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.attendance_logs OWNER TO postgres;

--
-- Name: attendance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_logs_id_seq OWNER TO postgres;

--
-- Name: attendance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_logs_id_seq OWNED BY public.attendance_logs.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    target_table character varying(50) NOT NULL,
    record_id character varying(100) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: daily_attendance_summary; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_attendance_summary (
    id bigint NOT NULL,
    employee_id uuid NOT NULL,
    work_date date NOT NULL,
    shift_id integer,
    first_check_in timestamp(6) with time zone,
    last_check_out timestamp(6) with time zone,
    total_working_hours numeric(5,2) DEFAULT 0 NOT NULL,
    late_early integer DEFAULT 0 NOT NULL,
    overtime integer DEFAULT 0 NOT NULL,
    attendance_status character varying(30) DEFAULT 'PRESENT'::character varying NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.daily_attendance_summary OWNER TO postgres;

--
-- Name: daily_attendance_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_attendance_summary_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_attendance_summary_id_seq OWNER TO postgres;

--
-- Name: daily_attendance_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_attendance_summary_id_seq OWNED BY public.daily_attendance_summary.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    department_code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;

--
-- Name: bonus_penalty; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bonus_penalty (
    id integer NOT NULL,
    overtime_rate numeric(10,2) DEFAULT 1.50 NOT NULL,
    late_early_penalty numeric(15,2) DEFAULT 0.00 NOT NULL,
    description character varying(255),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.bonus_penalty OWNER TO postgres;

--
-- Name: bonus_penalty_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bonus_penalty_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.bonus_penalty_id_seq OWNER TO postgres;

ALTER SEQUENCE public.bonus_penalty_id_seq OWNED BY public.bonus_penalty.id;



--
-- Name: employee_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_shifts (
    id bigint NOT NULL,
    employee_id uuid NOT NULL,
    shift_id integer DEFAULT 1 NOT NULL,
    work_date date NOT NULL,
    work_day character varying(50) DEFAULT 'Thứ Hai'::character varying,
    shift_type character varying(50) DEFAULT 'OFFICE_HOURS'::character varying,
    start_time character varying(20) DEFAULT '08:00'::character varying,
    end_time character varying(20) DEFAULT '17:30'::character varying,
    note character varying(255),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.employee_shifts OWNER TO postgres;

--
-- Name: employee_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_shifts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_shifts_id_seq OWNER TO postgres;

--
-- Name: employee_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_shifts_id_seq OWNED BY public.employee_shifts.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_code character varying(50) NOT NULL,
    user_id uuid,
    department_id integer,
    full_name character varying(100) NOT NULL,
    "position" character varying(100),
    phone character varying(20),
    email character varying(100),
    avatar_url text,
    hourly_rate numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: face_embeddings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.face_embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    embedding real[],
    model_version character varying(50) DEFAULT 'arcface_v1'::character varying NOT NULL,
    sample_tag character varying(50) DEFAULT 'FRONTAL'::character varying,
    quality_score double precision,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.face_embeddings OWNER TO postgres;

--
-- Name: payroll_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_records (
    id bigint NOT NULL,
    employee_id uuid NOT NULL,
    payroll_period character varying(7) NOT NULL,
    hourly_rate numeric(15,2) DEFAULT 0 NOT NULL,
    total_overtime numeric(10,2) DEFAULT 0 NOT NULL,
    total_late_early numeric(10,2) DEFAULT 0 NOT NULL,
    net_salary numeric(15,2) DEFAULT 0 NOT NULL,
    total_working_hours numeric(6,2) DEFAULT 0 NOT NULL,
    allowance numeric(15,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.payroll_records OWNER TO postgres;

--
-- Name: payroll_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payroll_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_records_id_seq OWNER TO postgres;

--
-- Name: payroll_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payroll_records_id_seq OWNED BY public.payroll_records.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    role_name character varying(50) NOT NULL,
    description text
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: work_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_shifts (
    id integer NOT NULL,
    shift_name character varying(50) NOT NULL,
    start_time time(6) without time zone NOT NULL,
    end_time time(6) without time zone NOT NULL,
    grace_period_minutes integer DEFAULT 15 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.work_shifts OWNER TO postgres;

--
-- Name: work_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_shifts_id_seq OWNER TO postgres;

--
-- Name: work_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_shifts_id_seq OWNED BY public.work_shifts.id;


--
-- Name: attendance_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs ALTER COLUMN id SET DEFAULT nextval('public.attendance_logs_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: daily_attendance_summary id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance_summary ALTER COLUMN id SET DEFAULT nextval('public.daily_attendance_summary_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: employee_shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts ALTER COLUMN id SET DEFAULT nextval('public.employee_shifts_id_seq'::regclass);


--
-- Name: payroll_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_records ALTER COLUMN id SET DEFAULT nextval('public.payroll_records_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: work_shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_shifts ALTER COLUMN id SET DEFAULT nextval('public.work_shifts_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
\.


--
-- Data for Name: attendance_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_logs (id, employee_id, event_time, type, method, device_info, verification_score, liveness_score, status, created_at) FROM stdin;
1	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-09-10 15:02:14+07	CHECK_IN	FACE	FaceCam-01	0.998	\N	VALID	2026-09-11 21:23:00.281+07
2	6d83f62e-c2a3-4fa4-a625-415072e5fe70	2026-09-10 15:26:05+07	CHECK_IN	FACE	CAM-04	0.994	\N	VALID	2026-09-11 21:23:00.282+07
3	703c9ae2-1361-44a8-b4fe-987a5865b1b5	2026-09-10 14:55:40+07	CHECK_IN	FACE	FaceCam-01	0.999	\N	VALID	2026-09-11 21:23:00.283+07
4	6aca9743-ff80-45a4-b20f-a4e51212d204	2026-09-10 15:35:10+07	CHECK_IN	FINGERPRINT	FP-Gate-02	0.985	\N	VALID	2026-09-11 21:23:00.283+07
5	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-09-09 15:01:20+07	CHECK_IN	FACE	FaceCam-01	0.997	\N	VALID	2026-09-11 21:23:00.284+07
6	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-09-10 00:32:00+07	CHECK_OUT	FACE	FaceCam-01	0.995	\N	VALID	2026-09-11 21:23:00.284+07
7	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-09-08 15:00:10+07	CHECK_IN	FACE	FaceCam-01	0.998	\N	VALID	2026-09-11 21:23:00.285+07
8	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-09-09 02:30:15+07	CHECK_OUT	FACE	FaceCam-01	0.996	\N	VALID	2026-09-11 21:23:00.285+07
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, action, target_table, record_id, old_values, new_values, created_at) FROM stdin;
\.


--
-- Data for Name: daily_attendance_summary; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_attendance_summary (id, employee_id, work_date, shift_id, first_check_in, last_check_out, total_working_hours, late_minutes, early_leave_minutes, attendance_status, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, department_code, name, created_at) FROM stdin;
9	DEPT_AI	Kỹ thuật AI	2026-09-11 21:23:00.197+07
10	DEPT_IT	Vận hành & IT	2026-09-11 21:23:00.198+07
11	DEPT_HR	Nhân sự & HR	2026-09-11 21:23:00.199+07
12	DEPT_BIZ	Kinh doanh & Dự án	2026-09-11 21:23:00.199+07
\.


--
-- Data for Name: employee_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_shifts (id, employee_id, shift_id, work_date, work_day, shift_type, start_time, end_time, note, created_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, employee_code, user_id, department_id, full_name, "position", phone, email, avatar_url, hourly_rate, status, created_at, updated_at) FROM stdin;
53e05d36-1dcb-4e94-b410-1141a0e4c76e	NV-001	2cc60bd6-f2aa-4883-b8f6-4c4eb2e3d415	9	Nguyễn Văn A	AI Engineer Lead	0987.654.321	anv@aiot.corp	https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42	125000.00	ACTIVE	2024-01-15 15:00:00+07	2026-09-11 21:23:00.266+07
6d83f62e-c2a3-4fa4-a625-415072e5fe70	NV-002	\N	10	Lê Hoàng Phúc	DevOps Engineer	0912.888.999	staff@company.com	https://lh3.googleusercontent.com/aida/AEtjO1WI3ysdLdr6Ya6JgC-p_9Nrkual12Y1Q6p9q4Ln5kqEpHlD50Rf1fcFfWprqeiBnI7yplufSIPIriJBm7cmqB9foAoNHZen3eTFSXz2qDN7q8YMY4rzBTWQDerqU9fyTBkbyV1XkqNLbr1gaEf5pNt4z-p2XSFW0goQoox1RfdhgeYyFDqdH1XwQLMvES4M7Jxu_utGWnqzMjF1b3SMgovKmeeN--rfL1vVW2BVhMloJ9HYKfXBJ81hcv8	110000.00	ACTIVE	2024-03-10 15:00:00+07	2026-09-11 21:23:00.267+07
703c9ae2-1361-44a8-b4fe-987a5865b1b5	NV-003	967a19a9-cd06-4018-83ef-6f90e024231f	11	Nguyễn Minh Anh	HR Operations Manager	0934.567.890	manager@company.com	https://lh3.googleusercontent.com/aida/AEtjO1U0gZ8qJdE6oYqQ-R2V5d_h0b4VdCqX1_qZ_6M9=s256	150000.00	ACTIVE	2023-11-01 15:00:00+07	2026-09-11 21:23:00.269+07
7f35b3d9-4e37-465a-8b66-848347a86ff3	NV-004	\N	9	Trần Thu Thảo	Computer Vision Researcher	0905.123.456	thao.tran@aiot.corp	https://lh3.googleusercontent.com/aida/AEtjO1Xw6tE-Kl6RJ0I4DImDsStSZc3dy2IU_ZbQk7wMhedEX9JhhFr0BZokHPz0wSZrZhqjYywULEMWtq5lPcL84X3aM6fdTnuWFHzAYO3Bq6xU57QOSfoPRD7TkdbT3C60GjGqI1SuN0moP_3u2hSYDZHJ_pViM0_ZPsVZizt9_RU5HK2yV0zXt5eWr5Un4rF1mMKbeZWwUieS7vg9zysgFJYqzQ9echXu2Lpdj6jcibnSkIeyv6bp8_gD3rg	120000.00	ACTIVE	2024-05-20 15:00:00+07	2026-09-11 21:23:00.269+07
6aca9743-ff80-45a4-b20f-a4e51212d204	NV-005	\N	10	Nguyễn Hải Nam	IoT Hardware Specialist	0977.444.333	nam.nguyen@aiot.corp	https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80	100000.00	ACTIVE	2024-06-15 15:00:00+07	2026-09-11 21:23:00.27+07
bebd7f11-6acb-4f8b-988d-2b31aee10617	NV-006	\N	12	Vũ Khánh Linh	Solutions Specialist	0944.555.666	linh.vu@aiot.corp	https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80	95000.00	INACTIVE	2024-02-01 15:00:00+07	2026-09-11 21:23:00.271+07
\.


--
-- Data for Name: face_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.face_embeddings (id, employee_id, embedding, model_version, sample_tag, quality_score, is_active, created_at) FROM stdin;
bdcc0efa-5e5b-49a4-992f-7e8b1c8a11bb	53e05d36-1dcb-4e94-b410-1141a0e4c76e	{0.468,0.0997,0.3882,0.7467,0.4969,0.1189,0.9965,0.3229,0.4021,0.2079,0.1718,0.4116,0.6924,0.055,0.5336,0.1611,0.5252,0.9693,0.7185,0.4014,0.7601,0.9897,0.4821,0.0473,0.542,0.198,0.6646,0.7525,0.1626,0.4427,0.0728,0.4116,0.133,0.3218,0.6525,0.986,0.1165,0.4571,0.4667,0.1203,0.8406,0.216,0.1852,0.9759,0.49,0.5226,0.1151,0.3132,0.5026,0.5191,0.3867,0.9462,0.2576,0.3257,0.2487,0.1769,0.4215,0.2762,0.1355,0.3967,0.8533,0.291,0.2962,0.865,0.7951,0.373,0.485,0.0894,0.8914,0.0001,0.3477,0.6075,0.6261,0.4496,0.6537,0.2774,0.0395,0.7784,0.5222,0.9474,0.197,0.762,0.6794,0.9585,0.277,0.2361,0.345,0.7972,0.381,0.7493,0.9446,0.0275,0.9704,0.6265,0.2258,0.0014,0.1879,0.451,0.687,0.096,0.543,0.3975,0.8067,0.0005,0.8066,0.4948,0.0703,0.6052,0.5203,0.4081,0.4561,0.9545,0.2909,0.4043,0.2744,0.1031,0.8108,0.6206,0.5895,0.82,0.4121,0.895,0.7125,0.0719,0.8762,0.9792,0.07,0.8085}	arcface_v1	FRONTAL	0.98	t	2026-09-11 21:23:00.273+07
3fd9b0ec-ee29-4547-8027-b20a62a8a044	6d83f62e-c2a3-4fa4-a625-415072e5fe70	{0.9549,0.5945,0.8585,0.0396,0.6674,0.6071,0.2963,0.4353,0.5641,0.9209,0.3693,0.3761,0.1508,0.5978,0.7479,0.8165,0.2033,0.1926,0.3763,0.8854,0.9486,0.4434,0.2523,0.9847,0.3549,0.233,0.8471,0.8778,0.7479,0.8812,0.3121,0.6468,0.708,0.9773,0.8099,0.1041,0.9498,0.3759,0.7556,0.3009,0.0926,0.1552,0.4611,0.0817,0.9321,0.6592,0.412,0.1209,0.6426,0.7087,0.585,0.3721,0.9953,0.6229,0.8898,0.7293,0.1455,0.0562,0.37,0.5389,0.7153,0.0247,0.774,0.3301,0.383,0.4627,0.4449,0.1931,0.1137,0.186,0.6228,0.1396,0.6203,0.2838,0.9499,0.5555,0.3312,0.8548,0.9919,0.3038,0.1243,0.108,0.6755,0.0138,0.1328,0.4152,0.0241,0.1765,0.0193,0.422,0.6288,0.3962,0.6388,0.1486,0.7394,0.0401,0.6756,0.3384,0.6631,0.5483,0.8619,0.5024,0.9656,0.8277,0.1452,0.2875,0.4968,0.0274,0.2961,0.4442,0.3071,0.5577,0.3525,0.8297,0.7314,0.3264,0.3746,0.2813,0.9529,0.1019,0.3958,0.8356,0.4863,0.816,0.206,0.416,0.8603,0.5535}	arcface_v1	FRONTAL	0.98	t	2026-09-11 21:23:00.275+07
6747ffe9-3be7-43b0-af20-53ff72951cac	703c9ae2-1361-44a8-b4fe-987a5865b1b5	{0.8181,0.5985,0.5057,0.0022,0.8135,0.1173,0.8906,0.2306,0.8511,0.0323,0.7826,0.8065,0.8912,0.1786,0.4893,0.3269,0.9193,0.6303,0.7252,0.3062,0.5037,0.6159,0.854,0.2827,0.9744,0.5615,0.314,0.8356,0.7913,0.631,0.4528,0.9033,0.7522,0.4238,0.8454,0.6506,0.4216,0.6692,0.6511,0.8747,0.3546,0.4605,0.6906,0.4529,0.6735,0.3098,0.0448,0.1911,0.4882,0.6343,0.5377,0.8014,0.2343,0.1264,0.2339,0.436,0.1218,0.035,0.8714,0.2031,0.2565,0.7813,0.4003,0.432,0.9439,0.6801,0.8142,0.9425,0.1667,0.168,0.2376,0.9061,0.175,0.4528,0.8755,0.1836,0.6984,0.1744,0.8126,0.8404,0.8,0.6225,0.8297,0.1956,0.9419,0.0725,0.6601,0.1106,0.3777,0.2406,0.4281,0.4401,0.05,0.5097,0.9239,0.0771,0.7291,0.0254,0.3978,0.3655,0.2971,0.3582,0.303,0.6821,0.2964,0.7877,0.7678,0.1568,0.1665,0.0302,0.7344,0.9772,0.6461,0.0082,0.8861,0.8349,0.2931,0.6594,0.5037,0.5078,0.2859,0.1049,0.4362,0.7275,0.9585,0.9954,0.4979,0.5035}	arcface_v1	FRONTAL	0.98	t	2026-09-11 21:23:00.277+07
0249019e-6e9d-4494-bd79-d551d5529d23	7f35b3d9-4e37-465a-8b66-848347a86ff3	{0.9601,0.8528,0.528,0.2485,0.7632,0.7273,0.3347,0.3786,0.6208,0.4254,0.512,0.5034,0.9753,0.805,0.3558,0.7332,0.6295,0.7783,0.7941,0.4697,0.5983,0.5128,0.7645,0.7651,0.3975,0.3881,0.8007,0.611,0.8037,0.6129,0.951,0.4327,0.0326,0.2893,0.8859,0.8964,0.0445,0.1196,0.9836,0.9203,0.9299,0.8386,0.8224,0.6249,0.3955,0.5694,0.5842,0.4142,0.3029,0.7236,0.5655,0.4615,0.7635,0.707,0.3797,0.5368,0.556,0.0681,0.0535,0.5089,0.0714,0.5281,0.1654,0.3313,0.3193,0.4936,0.738,0.6794,0.6176,0.5167,0.9959,0.8827,0.4177,0.3296,0.1259,0.0379,0.6291,0.0236,0.5128,0.8462,0.4432,0.0379,0.6025,0.9579,0.8244,0.6107,0.6259,0.1719,0.2469,0.7769,0.4039,0.3415,0.1449,0.4135,0.7167,0.6539,0.6318,0.8695,0.1714,0.121,0.3742,0.2039,0.9506,0.8081,0.0299,0.793,0.6413,0.9484,0.7483,0.1098,0.6376,0.6137,0.6407,0.2839,0.9567,0.3954,0.7707,0.3569,0.895,0.8935,0.2586,0.1594,0.7255,0.8739,0.465,0.9728,0.5233,0.7533}	arcface_v1	FRONTAL	0.98	t	2026-09-11 21:23:00.278+07
b6e42138-9cce-4567-9772-32fa3fcd1ae1	6aca9743-ff80-45a4-b20f-a4e51212d204	{0.9848,0.8877,0.2066,0.5522,0.5218,0.66,0.7231,0.7913,0.8579,0.657,0.9771,0.86,0.2503,0.5789,0.3089,0.812,0.4957,0.4612,0.5538,0.504,0.8489,0.9473,0.0193,0.1788,0.1036,0.1269,0.9421,0.7289,0.5054,0.7953,0.1718,0.0304,0.8096,0.4535,0.539,0.243,0.9067,0.7379,0.5388,0.0021,0.1107,0.9126,0.6777,0.8711,0.4304,0.3534,0.5268,0.1199,0.5532,0.6461,0.4105,0.6061,0.152,0.6281,0.9268,0.8253,0.2507,0.7064,0.9162,0.7488,0.24,0.7833,0.005,0.4399,0.9169,0.4328,0.7465,0.386,0.8284,0.3076,0.8224,0.5825,0.3646,0.2983,0.914,0.924,0.0892,0.107,0.7114,0.6305,0.3259,0.0617,0.0445,0.7158,0.3025,0.4408,0.3969,0.6315,0.7317,0.1483,0.9655,0.2683,0.6403,0.2691,0.4065,0.6161,0.3119,0.6381,0.6343,0.0667,0.3481,0.5084,0.809,0.7048,0.9044,0.2232,0.5517,0.3569,0.6906,0.3,0.7342,0.2776,0.6132,0.8251,0.2989,0.0155,0.6741,0.8351,0.8054,0.1711,0.3726,0.645,0.3664,0.4839,0.7813,0.6903,0.0667,0.0616}	arcface_v1	FRONTAL	0.98	t	2026-09-11 21:23:00.279+07
\.


--
-- Data for Name: payroll_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_records (id, employee_id, payroll_period, hourly_rate, total_overtime, total_late_early, net_salary, total_working_hours, allowance, status, created_at, updated_at) FROM stdin;
1	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-08	125000.00	0.00	0.00	24500000.00	176.00	2500000.00	PENDING	2026-09-11 21:23:00.286+07	2026-09-11 21:23:00.286+07
2	6d83f62e-c2a3-4fa4-a625-415072e5fe70	2026-08	110000.00	0.00	50000.00	21110000.00	176.00	1800000.00	PENDING	2026-09-11 21:23:00.287+07	2026-09-11 21:23:00.287+07
3	703c9ae2-1361-44a8-b4fe-987a5865b1b5	2026-08	150000.00	0.00	0.00	29600000.00	176.00	3200000.00	PENDING	2026-09-11 21:23:00.288+07	2026-09-11 21:23:00.288+07
4	7f35b3d9-4e37-465a-8b66-848347a86ff3	2026-08	120000.00	0.00	0.00	22160000.00	168.00	2000000.00	PENDING	2026-09-11 21:23:00.289+07	2026-09-11 21:23:00.289+07
5	6aca9743-ff80-45a4-b20f-a4e51212d204	2026-08	100000.00	0.00	150000.00	17350000.00	160.00	1500000.00	PENDING	2026-09-11 21:23:00.289+07	2026-09-11 21:23:00.289+07
6	53e05d36-1dcb-4e94-b410-1141a0e4c76e	2026-07	125000.00	0.00	0.00	25200000.00	184.00	2200000.00	FINALIZED	2026-09-11 21:23:00.29+07	2026-09-11 21:23:00.29+07
7	6d83f62e-c2a3-4fa4-a625-415072e5fe70	2026-07	110000.00	0.00	0.00	22040000.00	184.00	1800000.00	FINALIZED	2026-09-11 21:23:00.29+07	2026-09-11 21:23:00.29+07
8	703c9ae2-1361-44a8-b4fe-987a5865b1b5	2026-07	150000.00	0.00	0.00	30800000.00	184.00	3200000.00	FINALIZED	2026-09-11 21:23:00.291+07	2026-09-11 21:23:00.291+07
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, role_name, description) FROM stdin;
7	ADMIN	Quản trị viên hệ thống
8	MANAGER	Quản lý nhân sự
9	EMPLOYEE	Nhân viên thông thường
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role_id, is_active, last_login_at, created_at, updated_at) FROM stdin;
879e95fd-bc50-4a9f-98ac-b959e8f2c2a7	admin	$2a$10$iwN1H91E3QN7fiboxNLqIeVMRgMJi3OUcEVaqU7l./aIRFC6TCsoC	7	t	\N	2026-09-11 21:23:00.26+07	2026-09-11 21:23:00.26+07
967a19a9-cd06-4018-83ef-6f90e024231f	manager	$2a$10$iwN1H91E3QN7fiboxNLqIeVMRgMJi3OUcEVaqU7l./aIRFC6TCsoC	8	t	\N	2026-09-11 21:23:00.263+07	2026-09-11 21:23:00.263+07
2cc60bd6-f2aa-4883-b8f6-4c4eb2e3d415	staff	$2a$10$iwN1H91E3QN7fiboxNLqIeVMRgMJi3OUcEVaqU7l./aIRFC6TCsoC	9	t	\N	2026-09-11 21:23:00.264+07	2026-09-11 21:23:00.264+07
\.


--
-- Data for Name: work_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_shifts (id, shift_name, start_time, end_time, grace_period_minutes, created_at) FROM stdin;
3	Ca Hành Chính	08:00:00	17:30:00	15	2026-09-11 21:23:00.2+07
\.


--
-- Name: attendance_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_logs_id_seq', 8, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: daily_attendance_summary_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_attendance_summary_id_seq', 1, false);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.departments_id_seq', 12, true);


--
-- Name: employee_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_shifts_id_seq', 1, false);


--
-- Name: payroll_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_records_id_seq', 8, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 9, true);


--
-- Name: work_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_shifts_id_seq', 3, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: attendance_logs attendance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);


--
-- Name: bonus_penalty bonus_penalty_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bonus_penalty
    ADD CONSTRAINT bonus_penalty_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bonus_penalty ALTER COLUMN id SET DEFAULT nextval('public.bonus_penalty_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: daily_attendance_summary daily_attendance_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance_summary
    ADD CONSTRAINT daily_attendance_summary_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: face_embeddings face_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_embeddings
    ADD CONSTRAINT face_embeddings_pkey PRIMARY KEY (id);


--
-- Name: payroll_records payroll_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_shifts work_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id);


--
-- Name: departments_department_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX departments_department_code_key ON public.departments USING btree (department_code);


--
-- Name: employees_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX employees_email_key ON public.employees USING btree (email);


--
-- Name: employees_employee_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX employees_employee_code_key ON public.employees USING btree (employee_code);


--
-- Name: employees_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX employees_user_id_key ON public.employees USING btree (user_id);


--
-- Name: idx_attendance_emp_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_emp_time ON public.attendance_logs USING btree (employee_id, event_time DESC);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_daily_summary_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_summary_date ON public.daily_attendance_summary USING btree (work_date);


--
-- Name: idx_emp_shifts_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emp_shifts_lookup ON public.employee_shifts USING btree (employee_id, work_date);


--
-- Name: idx_employees_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_code ON public.employees USING btree (employee_code);


--
-- Name: idx_employees_dept; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_dept ON public.employees USING btree (department_id);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_face_embeddings_emp_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_face_embeddings_emp_id ON public.face_embeddings USING btree (employee_id);


--
-- Name: idx_payroll_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payroll_period ON public.payroll_records USING btree (payroll_period);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: roles_role_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_role_name_key ON public.roles USING btree (role_name);


--
-- Name: uq_emp_payroll_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_emp_payroll_period ON public.payroll_records USING btree (employee_id, payroll_period);


--
-- Name: uq_emp_work_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_emp_work_date ON public.daily_attendance_summary USING btree (employee_id, work_date);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: attendance_logs attendance_logs_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_attendance_summary daily_attendance_summary_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance_summary
    ADD CONSTRAINT daily_attendance_summary_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: daily_attendance_summary daily_attendance_summary_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance_summary
    ADD CONSTRAINT daily_attendance_summary_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id) ON DELETE SET NULL;


--
-- Name: employee_shifts employee_shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_shifts employee_shifts_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id) ON DELETE RESTRICT;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: face_embeddings face_embeddings_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.face_embeddings
    ADD CONSTRAINT face_embeddings_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payroll_records payroll_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict dHclnG07jXSm4t0uUXaihpam8z2B9hfDqrbKs5oIprvCr2wImeyXaZ5xQ02US6V

