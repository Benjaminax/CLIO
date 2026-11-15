import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar,
  Clock,
  User,
  Users,
  Building,
  GraduationCap,
  Sparkles,
  ArrowLeftRight,
  Download,
  Share2,
  Check,
  X,
  AlertTriangle,
  Bell,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Video,
  Monitor,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
  CalendarCheck,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

// ─── TYPES & INTERFACES ───────────────────────────────────────────────────────

export type UserRole = "teacher" | "student" | "admin";

export type RoomType = "lecture_hall" | "standard_classroom" | "specialized_lab";

export interface Classroom {
  id: string;
  name: string;
  code: string;
  type: RoomType;
  capacity: number;
  building: string;
  specialtyEquipment?: string;
  isAvailableForEvents?: boolean;
}

export interface Lecturer {
  id: string;
  fullName: string;
  email: string; // must end with @acity.edu.gh
  department: string;
  title: string;
  unavailableSlots: string[]; // e.g., ["Monday-08:00", "Friday-13:00"]
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
  cohort: string; // e.g. "Level 300 CS", "Level 200 CE"
  enrolledStudents: number;
  credits: number;
  theoryHours: number;
  practicalHours: number; // requires specialized lab
  assignedLecturerId: string;
  color: string;
}

export interface TimetableSlot {
  id: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  timeSlot: "08:00 - 10:00" | "10:15 - 12:15" | "12:45 - 14:45" | "15:00 - 17:00";
  courseId: string;
  lecturerId: string;
  classroomId: string;
  sessionType: "theory" | "practical";
  isOnline: boolean;
  onlineMeetingLink?: string;
  status: "confirmed" | "pending_swap" | "relocated_due_to_event";
  eventNote?: string;
}

export interface ExamSession {
  id: string;
  courseCode: string;
  courseTitle: string;
  cohort: string;
  date: string;
  session: "morning" | "afternoon";
  timeRange: string; // "09:00 - 11:30" or "13:00 - 15:30"
  roomName: string;
  seatNumber: string; // e.g. "Seat #LH1-042"
  invigilator: string;
}

export interface EventBooking {
  id: string;
  title: string;
  classroomId: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  timeSlot: "08:00 - 10:00" | "10:15 - 12:15" | "12:45 - 14:45" | "15:00 - 17:00";
  organizer: string;
  description: string;
  createdAt: string;
}

export interface AuditNotification {
  id: string;
  type: "swap_request" | "event_conflict" | "online_switch" | "schedule_published";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetRole: "admin" | "teacher" | "student" | "all";
  lecturerEmail?: string;
}

// ─── INITIAL MOCK DATA (ACADEMIC CITY UNIVERSITY COLLEGE) ──────────────────────

const INITIAL_ROOMS: Classroom[] = [
  {
    id: "room-101",
    name: "Engineering Lecture Hall 1",
    code: "ELH-01",
    type: "lecture_hall",
    capacity: 120,
    building: "Academic Block A",
    isAvailableForEvents: true,
  },
  {
    id: "room-102",
    name: "Science Hall 2",
    code: "SH-02",
    type: "lecture_hall",
    capacity: 90,
    building: "Academic Block A",
    isAvailableForEvents: true,
  },
  {
    id: "room-201",
    name: "Computing Classroom 3A",
    code: "CC-3A",
    type: "standard_classroom",
    capacity: 45,
    building: "Block B",
  },
  {
    id: "room-202",
    name: "Business Seminar Room 1",
    code: "BSR-01",
    type: "standard_classroom",
    capacity: 40,
    building: "Block B",
  },
  {
    id: "lab-301",
    name: "Robotics & Embedded Systems Lab",
    code: "ROBO-LAB",
    type: "specialized_lab",
    capacity: 35,
    building: "Innovation Hub",
    specialtyEquipment: "Microcontrollers, Oscilloscopes, FPGA kits, 3D Printers",
  },
  {
    id: "lab-302",
    name: "Advanced AI & Cloud Computing Lab",
    code: "AI-LAB",
    type: "specialized_lab",
    capacity: 40,
    building: "Innovation Hub",
    specialtyEquipment: "Dual-GPU Workstations, Server Racks, Jetson Orin Nodes",
  },
  {
    id: "lab-303",
    name: "Digital Circuits & Electronics Lab",
    code: "ELEC-LAB",
    type: "specialized_lab",
    capacity: 35,
    building: "Engineering Block C",
    specialtyEquipment: "Spectrum Analyzers, Circuit Breadboards, Soldering Stations",
  },
];

const INITIAL_LECTURERS: Lecturer[] = [
  {
    id: "lec-1",
    fullName: "Dr. Kwame Mensah",
    email: "dr.kwame.mensah@acity.edu.gh",
    department: "Computer Science & Informatics",
    title: "Senior Lecturer",
    unavailableSlots: ["Monday-08:00 - 10:00", "Wednesday-15:00 - 17:00"],
  },
  {
    id: "lec-2",
    fullName: "Prof. Esi Boateng",
    email: "prof.esi.boateng@acity.edu.gh",
    department: "Electrical & Computer Engineering",
    title: "Associate Professor",
    unavailableSlots: ["Friday-12:45 - 14:45", "Friday-15:00 - 17:00"],
  },
  {
    id: "lec-3",
    fullName: "Dr. Francis Asante",
    email: "dr.francis.asante@acity.edu.gh",
    department: "Robotics & Mechanical Systems",
    title: "Head of Robotics",
    unavailableSlots: ["Tuesday-08:00 - 10:00"],
  },
  {
    id: "lec-4",
    fullName: "Ms. Afua Osei",
    email: "afua.osei@acity.edu.gh",
    department: "Software Engineering",
    title: "Lecturer & Lab Director",
    unavailableSlots: ["Thursday-15:00 - 17:00"],
  },
];

const INITIAL_COURSES: Course[] = [
  {
    id: "crs-1",
    code: "CPEN 302",
    title: "Embedded Systems Design",
    department: "Computer Engineering",
    cohort: "Level 300 CE",
    enrolledStudents: 32,
    credits: 3,
    theoryHours: 2,
    practicalHours: 2, // Needs Specialized Lab!
    assignedLecturerId: "lec-1",
    color: "#3b82f6",
  },
  {
    id: "crs-2",
    code: "CSCD 314",
    title: "Artificial Intelligence & ML",
    department: "Computer Science",
    cohort: "Level 300 CS",
    enrolledStudents: 38,
    credits: 3,
    theoryHours: 2,
    practicalHours: 2, // Needs Specialized Lab!
    assignedLecturerId: "lec-1",
    color: "#8b5cf6",
  },
  {
    id: "crs-3",
    code: "ROBO 401",
    title: "Autonomous Robotics & Actuators",
    department: "Robotics",
    cohort: "Level 400 ROBO",
    enrolledStudents: 28,
    credits: 4,
    theoryHours: 2,
    practicalHours: 3, // Needs Specialized Lab!
    assignedLecturerId: "lec-3",
    color: "#ec4899",
  },
  {
    id: "crs-4",
    code: "SENG 204",
    title: "Data Structures & Algorithms",
    department: "Software Engineering",
    cohort: "Level 200 CS",
    enrolledStudents: 44,
    credits: 3,
    theoryHours: 2,
    practicalHours: 0, // Theory only
    assignedLecturerId: "lec-4",
    color: "#10b981",
  },
  {
    id: "crs-5",
    code: "EENG 305",
    title: "Signals and Systems",
    department: "Electrical Engineering",
    cohort: "Level 300 EE",
    enrolledStudents: 34,
    credits: 3,
    theoryHours: 2,
    practicalHours: 2, // Needs Specialized Lab!
    assignedLecturerId: "lec-2",
    color: "#f59e0b",
  },
];

const INITIAL_SLOTS: TimetableSlot[] = [
  {
    id: "slot-1",
    day: "Monday",
    timeSlot: "10:15 - 12:15",
    courseId: "crs-1",
    lecturerId: "lec-1",
    classroomId: "room-101",
    sessionType: "theory",
    isOnline: false,
    status: "confirmed",
  },
  {
    id: "slot-2",
    day: "Wednesday",
    timeSlot: "08:00 - 10:00",
    courseId: "crs-1",
    lecturerId: "lec-1",
    classroomId: "lab-301", // Specialized Lab
    sessionType: "practical",
    isOnline: false,
    status: "confirmed",
  },
  {
    id: "slot-3",
    day: "Tuesday",
    timeSlot: "10:15 - 12:15",
    courseId: "crs-2",
    lecturerId: "lec-1",
    classroomId: "room-102",
    sessionType: "theory",
    isOnline: false,
    status: "confirmed",
  },
  {
    id: "slot-4",
    day: "Thursday",
    timeSlot: "12:45 - 14:45",
    courseId: "crs-2",
    lecturerId: "lec-1",
    classroomId: "lab-302", // Specialized Lab
    sessionType: "practical",
    isOnline: false,
    status: "confirmed",
  },
  {
    id: "slot-5",
    day: "Tuesday",
    timeSlot: "12:45 - 14:45",
    courseId: "crs-3",
    lecturerId: "lec-3",
    classroomId: "lab-301", // Specialized Lab
    sessionType: "practical",
    isOnline: false,
    status: "confirmed",
  },
  {
    id: "slot-6",
    day: "Monday",
    timeSlot: "12:45 - 14:45",
    courseId: "crs-4",
    lecturerId: "lec-4",
    classroomId: "room-201",
    sessionType: "theory",
    isOnline: false,
    status: "confirmed",
  },
  {
    id: "slot-7",
    day: "Thursday",
    timeSlot: "08:00 - 10:00",
    courseId: "crs-5",
    lecturerId: "lec-2",
    classroomId: "lab-303", // Specialized Lab
    sessionType: "practical",
    isOnline: false,
    status: "confirmed",
  },
];

const INITIAL_EXAMS: ExamSession[] = [
  {
    id: "exam-1",
    courseCode: "CPEN 302",
    courseTitle: "Embedded Systems Design",
    cohort: "Level 300 CE",
    date: "Monday, Dec 14, 2026",
    session: "morning",
    timeRange: "09:00 - 11:30 AM",
    roomName: "Engineering Lecture Hall 1",
    seatNumber: "Seat #ELH-042",
    invigilator: "Prof. Esi Boateng",
  },
  {
    id: "exam-2",
    courseCode: "CSCD 314",
    courseTitle: "Artificial Intelligence & ML",
    cohort: "Level 300 CS",
    date: "Wednesday, Dec 16, 2026",
    session: "morning",
    timeRange: "09:00 - 11:30 AM",
    roomName: "Science Hall 2",
    seatNumber: "Seat #SH2-019",
    invigilator: "Dr. Francis Asante",
  },
  {
    id: "exam-3",
    courseCode: "SENG 204",
    courseTitle: "Data Structures & Algorithms",
    cohort: "Level 200 CS",
    date: "Friday, Dec 18, 2026",
    session: "afternoon",
    timeRange: "01:00 - 03:30 PM",
    roomName: "Engineering Lecture Hall 1",
    seatNumber: "Seat #ELH-088",
    invigilator: "Dr. Kwame Mensah",
  },
];

const DAYS: ("Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday")[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const TIME_SLOTS: ("08:00 - 10:00" | "10:15 - 12:15" | "12:45 - 14:45" | "15:00 - 17:00")[] = [
  "08:00 - 10:00",
  "10:15 - 12:15",
  "12:45 - 14:45",
  "15:00 - 17:00",
];

// ─── MAIN ACADEMIC TIMETABLE & SCHEDULING COMPONENT ───────────────────────────

export default function AcademicTimetable({ onBack }: { onBack?: () => void }) {
  // Global Portal state
  const [activeRole, setActiveRole] = useState<UserRole>("teacher");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("lec-1");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("ACU-2024-0412");
  const [studentCohort, setStudentCohort] = useState<string>("Level 300 CS");

  // Core Data
  const [rooms, setRooms] = useState<Classroom[]>(() => {
    try {
      const saved = localStorage.getItem("clio_acad_rooms");
      return saved ? JSON.parse(saved) : INITIAL_ROOMS;
    } catch {
      return INITIAL_ROOMS;
    }
  });

  const [lecturers, setLecturers] = useState<Lecturer[]>(() => {
    try {
      const saved = localStorage.getItem("clio_acad_lecturers");
      return saved ? JSON.parse(saved) : INITIAL_LECTURERS;
    } catch {
      return INITIAL_LECTURERS;
    }
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem("clio_acad_courses");
      return saved ? JSON.parse(saved) : INITIAL_COURSES;
    } catch {
      return INITIAL_COURSES;
    }
  });

  const [slots, setSlots] = useState<TimetableSlot[]>(() => {
    try {
      const saved = localStorage.getItem("clio_acad_slots");
      return saved ? JSON.parse(saved) : INITIAL_SLOTS;
    } catch {
      return INITIAL_SLOTS;
    }
  });

  const [eventBookings, setEventBookings] = useState<EventBooking[]>(() => {
    try {
      const saved = localStorage.getItem("clio_acad_events");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<AuditNotification[]>(() => {
    try {
      const saved = localStorage.getItem("clio_acad_notifications");
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: "notif-1",
              type: "schedule_published",
              title: "Draft Timetable Generated",
              message:
                "Academic City semester draft schedule generated. Lecturers may review and request swaps.",
              timestamp: "Today at 09:15 AM",
              read: false,
              targetRole: "all",
            },
          ];
    } catch {
      return [];
    }
  });

  // Modals & Panels
  const [swapModalSlot, setSwapModalSlot] = useState<TimetableSlot | null>(null);
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState<boolean>(false);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"schedule" | "exams" | "analytics" | "rooms" | "courses">("schedule");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Canvas ref for PNG export
  const printCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem("clio_acad_rooms", JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem("clio_acad_lecturers", JSON.stringify(lecturers));
  }, [lecturers]);

  useEffect(() => {
    localStorage.setItem("clio_acad_courses", JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem("clio_acad_slots", JSON.stringify(slots));
  }, [slots]);

  useEffect(() => {
    localStorage.setItem("clio_acad_events", JSON.stringify(eventBookings));
  }, [eventBookings]);

  useEffect(() => {
    localStorage.setItem("clio_acad_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Currently logged in lecturer
  const currentLecturer = useMemo(() => {
    return (
      lecturers.find((l) => l.id === selectedTeacherId) ||
      lecturers[0] || {
        id: "lec-1",
        fullName: "Dr. Kwame Mensah",
        email: "dr.kwame.mensah@acity.edu.gh",
        department: "Computer Science",
        title: "Senior Lecturer",
        unavailableSlots: [],
      }
    );
  }, [lecturers, selectedTeacherId]);

  // Courses assigned to this lecturer
  const assignedCoursesForTeacher = useMemo(() => {
    return courses.filter((c) => c.assignedLecturerId === currentLecturer.id);
  }, [courses, currentLecturer.id]);

  // Timetable slots for this lecturer
  const teacherSlots = useMemo(() => {
    return slots.filter((s) => s.lecturerId === currentLecturer.id);
  }, [slots, currentLecturer.id]);

  // Timetable slots for active student cohort
  const studentSlots = useMemo(() => {
    const cohortCourseIds = new Set(
      courses.filter((c) => c.cohort === studentCohort).map((c) => c.id)
    );
    return slots.filter((s) => cohortCourseIds.has(s.courseId));
  }, [slots, courses, studentCohort]);

  // ─── ACTION: TOGGLE TEACHER UNAVAILABILITY ──────────────────────────────────
  const toggleUnavailableSlot = (day: string, time: string) => {
    const slotKey = `${day}-${time}`;
    setLecturers((prev) =>
      prev.map((lec) => {
        if (lec.id !== currentLecturer.id) return lec;
        const exists = lec.unavailableSlots.includes(slotKey);
        const updated = exists
          ? lec.unavailableSlots.filter((k) => k !== slotKey)
          : [...lec.unavailableSlots, slotKey];
        return { ...lec, unavailableSlots: updated };
      })
    );
  };

  // ─── ACTION: SWAP OR RESCHEDULE CLASS SLOT ──────────────────────────────────
  const executeSlotSwap = (
    slotId: string,
    newDay: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday",
    newTime: "08:00 - 10:00" | "10:15 - 12:15" | "12:45 - 14:45" | "15:00 - 17:00",
    newRoomId: string,
    makeOnline: boolean = false
  ) => {
    const originalSlot = slots.find((s) => s.id === slotId);
    if (!originalSlot) return;

    const course = courses.find((c) => c.id === originalSlot.courseId);
    const room = rooms.find((r) => r.id === newRoomId);

    // Update slots
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          day: newDay,
          timeSlot: newTime,
          classroomId: newRoomId,
          isOnline: makeOnline,
          status: "confirmed",
          eventNote: undefined,
        };
      })
    );

    // Notify Admin
    const notifText = `${currentLecturer.fullName} rescheduled ${course?.code || "Class"} to ${newDay} at ${newTime} in ${
      makeOnline ? "Online Zoom / Meet" : room?.name || "classroom"
    }.`;

    const newNotif: AuditNotification = {
      id: `notif-${Date.now()}`,
      type: makeOnline ? "online_switch" : "swap_request",
      title: makeOnline ? "Class Converted to Online" : "Timetable Slot Moved by Lecturer",
      message: notifText,
      timestamp: "Just now",
      read: false,
      targetRole: "admin",
      lecturerEmail: currentLecturer.email,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setSwapModalSlot(null);
    showToast(
      makeOnline
        ? `✓ Class shifted to Online mode! Physical classroom freed.`
        : `✓ Class successfully moved to ${newDay} (${newTime})!`
    );
  };

  // ─── ACTION: BOOK CLASSROOM FOR AN EVENT (ADMIN) ───────────────────────────
  const bookClassroomForEvent = (
    title: string,
    classroomId: string,
    day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday",
    timeSlot: "08:00 - 10:00" | "10:15 - 12:15" | "12:45 - 14:45" | "15:00 - 17:00",
    description: string
  ) => {
    const room = rooms.find((r) => r.id === classroomId);

    // Check if any existing class clashes with this room
    const conflictingSlot = slots.find(
      (s) => s.classroomId === classroomId && s.day === day && s.timeSlot === timeSlot && !s.isOnline
    );

    const newEvent: EventBooking = {
      id: `event-${Date.now()}`,
      title,
      classroomId,
      day,
      timeSlot,
      organizer: "Academic Affairs & Planning",
      description,
      createdAt: new Date().toLocaleTimeString(),
    };

    setEventBookings((prev) => [newEvent, ...prev]);

    if (conflictingSlot) {
      const affectedCourse = courses.find((c) => c.id === conflictingSlot.courseId);
      const affectedLecturer = lecturers.find((l) => l.id === conflictingSlot.lecturerId);

      // Flag the slot
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== conflictingSlot.id) return s;
          return {
            ...s,
            status: "relocated_due_to_event",
            eventNote: `Room pre-empted by event: "${title}". Please choose a vacant room or move slot.`,
          };
        })
      );

      // Create notification for Lecturer
      const alertNotif: AuditNotification = {
        id: `alert-${Date.now()}`,
        type: "event_conflict",
        title: `Room Reassignment Alert: ${affectedCourse?.code}`,
        message: `Admin booked ${room?.name} for "${title}" on ${day} (${timeSlot}). Please pick a vacant room, reschedule for this week, or opt for Online.`,
        timestamp: "Just now",
        read: false,
        targetRole: "teacher",
        lecturerEmail: affectedLecturer?.email,
      };

      setNotifications((prev) => [alertNotif, ...prev]);
      showToast(`⚠ Event booked! ${affectedLecturer?.fullName} was notified of room relocation.`);
    } else {
      showToast(`✓ Room ${room?.name} booked for "${title}"!`);
    }

    setShowEventModal(false);
  };

  // ─── ACTION: EXPORT TIMETABLE AS PNG GRAPHIC ─────────────────────────────────
  const downloadTimetablePNG = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 760;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top Header Banner
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, 100);

    // Institution Branding
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px 'Inter Tight', sans-serif";
    ctx.fillText("ACADEMIC CITY UNIVERSITY COLLEGE", 40, 48);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px 'Inter Tight', sans-serif";
    const subTitle =
      activeRole === "teacher"
        ? `FACULTY TIMETABLE · ${currentLecturer.fullName} (${currentLecturer.email})`
        : activeRole === "student"
        ? `STUDENT TIMETABLE · ${studentCohort} · ID: ${selectedStudentId}`
        : "MASTER UNIVERSITY TIMETABLE · ACADEMIC PLANNING OFFICE";
    ctx.fillText(subTitle, 40, 78);

    // Date watermark
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("SEMESTER 1 · 2026/2027", 980, 50);

    // Grid Dimensions
    const startX = 40;
    const startY = 120;
    const colWidth = 215;
    const rowHeight = 135;

    // Draw Column Headers (Days)
    DAYS.forEach((day, index) => {
      const x = startX + index * colWidth;
      ctx.fillStyle = "#334155";
      ctx.fillRect(x, startY, colWidth - 8, 38);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(day, x + (colWidth - 8) / 2, startY + 24);
    });

    ctx.textAlign = "left";

    // Active slots to render based on role
    const activeSlots = activeRole === "teacher" ? teacherSlots : studentSlots;

    // Draw Slots
    TIME_SLOTS.forEach((slotTime, rowIndex) => {
      const y = startY + 48 + rowIndex * rowHeight;

      DAYS.forEach((day, colIndex) => {
        const x = startX + colIndex * colWidth;
        const matchingSlot = activeSlots.find((s) => s.day === day && s.timeSlot === slotTime);
        const course = matchingSlot ? courses.find((c) => c.id === matchingSlot.courseId) : null;
        const room = matchingSlot ? rooms.find((r) => r.id === matchingSlot.classroomId) : null;

        // Slot Background
        if (matchingSlot && course) {
          ctx.fillStyle = matchingSlot.isOnline
            ? "#065f46"
            : matchingSlot.sessionType === "practical"
            ? "#581c87"
            : "#1e3a8a";
          ctx.strokeStyle = matchingSlot.status === "relocated_due_to_event" ? "#ef4444" : "#475569";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x, y, colWidth - 8, rowHeight - 12, 8);
          ctx.fill();
          ctx.stroke();

          // Course Code
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px sans-serif";
          ctx.fillText(course.code, x + 12, y + 24);

          // Course Name
          ctx.fillStyle = "#e2e8f0";
          ctx.font = "11px sans-serif";
          ctx.fillText(course.title.slice(0, 24), x + 12, y + 44);

          // Time
          ctx.fillStyle = "#94a3b8";
          ctx.font = "10px sans-serif";
          ctx.fillText(slotTime, x + 12, y + 64);

          // Room Badge
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 11px sans-serif";
          const roomLabel = matchingSlot.isOnline
            ? "🌐 Online Class (Zoom)"
            : matchingSlot.sessionType === "practical"
            ? `🔬 ${room?.name.slice(0, 20)}`
            : `📍 ${room?.name.slice(0, 20)}`;
          ctx.fillText(roomLabel, x + 12, y + 90);

          if (matchingSlot.status === "relocated_due_to_event") {
            ctx.fillStyle = "#f87171";
            ctx.font = "bold 10px sans-serif";
            ctx.fillText("⚠ Event Conflict", x + 12, y + 108);
          }
        } else {
          // Empty slot placeholder
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x, y, colWidth - 8, rowHeight - 12, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#64748b";
          ctx.font = "11px sans-serif";
          ctx.fillText(slotTime, x + 12, y + 24);
          ctx.fillText("Free Period", x + 12, y + 48);
        }
      });
    });

    // Trigger Download
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `AcademicCity_Timetable_${activeRole}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
    showToast("✓ High-resolution Timetable PNG downloaded!");
  };

  // ─── ACTION: CONNECT / SYNC TO GOOGLE CALENDAR (.ics) ────────────────────────
  const exportGoogleCalendarIcs = () => {
    const activeSlots = activeRole === "teacher" ? teacherSlots : studentSlots;
    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Academic City University College//CLIO Timetable//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    activeSlots.forEach((slot) => {
      const course = courses.find((c) => c.id === slot.courseId);
      const room = rooms.find((r) => r.id === slot.classroomId);
      if (!course) return;

      icsContent.push(
        "BEGIN:VEVENT",
        `UID:${slot.id}@acity.edu.gh`,
        `SUMMARY:${course.code} - ${course.title} (${slot.sessionType.toUpperCase()})`,
        `DESCRIPTION:Lecturer: ${currentLecturer.fullName} | Cohort: ${course.cohort} | ${
          slot.isOnline ? "Online class via Google Meet" : room?.name
        }`,
        `LOCATION:${slot.isOnline ? "Online Google Meet" : room?.name || "Campus"}`,
        `STATUS:CONFIRMED`,
        "END:VEVENT"
      );
    });

    icsContent.push("END:VCALENDAR");

    const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AcademicCity_${activeRole}_Schedule.ics`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("✓ iCal / Google Calendar (.ics) file exported! Open in Google Calendar.");
  };

  // ─── ACTION: CONNECT TO NOTION (MARKDOWN DATABASE) ──────────────────────────
  const exportToNotion = () => {
    const activeSlots = activeRole === "teacher" ? teacherSlots : studentSlots;
    let markdown = `# Academic City University College - Timetable Sync\n\n`;
    markdown += `| Day | Time | Course | Type | Venue / Lab | Lecturer | Mode |\n`;
    markdown += `|---|---|---|---|---|---|---|\n`;

    activeSlots.forEach((slot) => {
      const course = courses.find((c) => c.id === slot.courseId);
      const room = rooms.find((r) => r.id === slot.classroomId);
      const lec = lecturers.find((l) => l.id === slot.lecturerId);
      markdown += `| ${slot.day} | ${slot.timeSlot} | **${course?.code}** - ${course?.title} | ${slot.sessionType} | ${
        room?.name
      } | ${lec?.fullName} | ${slot.isOnline ? "Online" : "In-Person"} |\n`;
    });

    navigator.clipboard?.writeText(markdown);
    showToast("✓ Notion Table Markdown copied to clipboard! Paste directly into any Notion page.");
  };

  // ─── COMPUTE SWAP OPTIONS FOR TEACHER ────────────────────────────────────────
  // Only shows conflict-free slots. If course is Practical, strictly shows specialized labs!
  const availableSwapDestinations = useMemo(() => {
    if (!swapModalSlot) return [];
    const course = courses.find((c) => c.id === swapModalSlot.courseId);
    if (!course) return [];

    const isPractical = swapModalSlot.sessionType === "practical";

    // Eligible rooms: If practical, STRICTLY specialized labs!
    const eligibleRooms = rooms.filter((r) => {
      if (isPractical) return r.type === "specialized_lab";
      return r.type !== "specialized_lab" || r.capacity >= course.enrolledStudents;
    });

    const results: {
      day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
      timeSlot: "08:00 - 10:00" | "10:15 - 12:15" | "12:45 - 14:45" | "15:00 - 17:00";
      room: Classroom;
      isOnlineCandidate?: boolean;
    }[] = [];

    DAYS.forEach((d) => {
      TIME_SLOTS.forEach((t) => {
        // 1. Is teacher unavailable at this time?
        const isTeacherBusy = currentLecturer.unavailableSlots.includes(`${d}-${t}`);
        if (isTeacherBusy) return;

        // 2. Does this teacher already have another class at this time?
        const teacherClassClash = slots.some(
          (s) => s.id !== swapModalSlot.id && s.lecturerId === currentLecturer.id && s.day === d && s.timeSlot === t
        );
        if (teacherClassClash) return;

        // 3. Does the cohort have another class at this time?
        const cohortClassClash = slots.some((s) => {
          if (s.id === swapModalSlot.id) return false;
          const otherCourse = courses.find((c) => c.id === s.courseId);
          return otherCourse?.cohort === course.cohort && s.day === d && s.timeSlot === t;
        });
        if (cohortClassClash) return;

        // 4. Find free rooms among eligible rooms
        eligibleRooms.forEach((r) => {
          const roomTakenByClass = slots.some(
            (s) => s.id !== swapModalSlot.id && s.classroomId === r.id && s.day === d && s.timeSlot === t && !s.isOnline
          );
          const roomTakenByEvent = eventBookings.some(
            (e) => e.classroomId === r.id && e.day === d && e.timeSlot === t
          );

          if (!roomTakenByClass && !roomTakenByEvent) {
            results.push({ day: d, timeSlot: t, room: r });
          }
        });
      });
    });

    return results;
  }, [swapModalSlot, courses, rooms, slots, currentLecturer, eventBookings]);

  return (
    <div className="acad-timetable-root" style={{ minHeight: "100vh", paddingBottom: "60px" }}>
      {/* ── TOP ROLE SELECTOR & BRAND BAR ─────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid var(--border, #e2e8f0)",
          background: "var(--card-bg, #ffffff)",
          padding: "16px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {onBack && (
            <button
              onClick={onBack}
              className="secondary"
              style={{ padding: "6px 10px", fontSize: "12px" }}
              title="Return to library"
            >
              ← Back
            </button>
          )}
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "#1e3a8a",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "14px",
            }}
          >
            ACU
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              Academic City University College
            </h1>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Intelligent Timetable & Scheduling Platform · Accra Campus
            </p>
          </div>
        </div>

        {/* Role Switcher Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px",
            borderRadius: "10px",
            background: "rgba(0,0,0,0.06)",
            gap: "4px",
          }}
        >
          <button
            onClick={() => {
              setActiveRole("teacher");
              setActiveTab("schedule");
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: 0,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: activeRole === "teacher" ? "#2563eb" : "transparent",
              color: activeRole === "teacher" ? "#ffffff" : "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <User size={14} /> Teacher View
          </button>

          <button
            onClick={() => {
              setActiveRole("student");
              setActiveTab("schedule");
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: 0,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: activeRole === "student" ? "#2563eb" : "transparent",
              color: activeRole === "student" ? "#ffffff" : "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <GraduationCap size={14} /> Student View
          </button>

          <button
            onClick={() => {
              setActiveRole("admin");
              setActiveTab("schedule");
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: 0,
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: activeRole === "admin" ? "#2563eb" : "transparent",
              color: activeRole === "admin" ? "#ffffff" : "inherit",
              transition: "all 0.15s ease",
            }}
          >
            <SlidersHorizontal size={14} /> Administrator View
          </button>
        </div>
      </header>

      {/* ── NOTIFICATION / ALERT BANNER (If event conflicts or swap updates exist) ── */}
      {notifications.length > 0 && notifications.some((n) => !n.read) && (
        <div
          style={{
            background: "linear-gradient(90deg, #1e3a8a, #3b82f6)",
            color: "#ffffff",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={15} />
            <span>
              <b>{notifications[0].title}:</b> {notifications[0].message}
            </span>
          </div>
          <button
            onClick={() =>
              setNotifications((prev) =>
                prev.map((n, i) => (i === 0 ? { ...n, read: true } : n))
              )
            }
            style={{
              background: "rgba(255,255,255,0.2)",
              border: 0,
              color: "#fff",
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── SUB-HEADER CONTROLS & EXPORT ACTIONS ─────────────────────────────── */}
      <section
        style={{
          padding: "16px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          background: "var(--bg-subtle, #f8fafc)",
          borderBottom: "1px solid var(--border, #e2e8f0)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {activeRole === "teacher" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Lecturer Account:</span>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "var(--card-bg, #ffffff)",
                }}
              >
                {lecturers.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.fullName} ({lec.email})
                  </option>
                ))}
              </select>

              <button
                className="secondary"
                onClick={() => setShowUnavailabilityModal(true)}
                style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", gap: "6px" }}
              >
                <Clock size={14} /> My Free / Unavailable Days
              </button>
            </div>
          )}

          {activeRole === "student" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Student ID:</span>
              <input
                type="text"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                placeholder="e.g. ACU-2024-0412"
                style={{
                  width: "140px",
                  padding: "5px 8px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              />

              <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Cohort:</span>
              <select
                value={studentCohort}
                onChange={(e) => setStudentCohort(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <option value="Level 300 CS">Level 300 Computer Science</option>
                <option value="Level 300 CE">Level 300 Computer Engineering</option>
                <option value="Level 400 ROBO">Level 400 Robotics</option>
                <option value="Level 200 CS">Level 200 Software Engineering</option>
                <option value="Level 300 EE">Level 300 Electrical</option>
              </select>

              <div style={{ display: "inline-flex", gap: "4px", marginLeft: "12px" }}>
                <button
                  className={activeTab === "schedule" ? "primary" : "secondary"}
                  onClick={() => setActiveTab("schedule")}
                  style={{ fontSize: "12px", padding: "5px 12px" }}
                >
                  Class Schedule
                </button>
                <button
                  className={activeTab === "exams" ? "primary" : "secondary"}
                  onClick={() => setActiveTab("exams")}
                  style={{ fontSize: "12px", padding: "5px 12px" }}
                >
                  Exam Timetable & Seats
                </button>
              </div>
            </div>
          )}

          {activeRole === "admin" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                className={activeTab === "schedule" ? "primary" : "secondary"}
                onClick={() => setActiveTab("schedule")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Master Schedule
              </button>
              <button
                className={activeTab === "analytics" ? "primary" : "secondary"}
                onClick={() => setActiveTab("analytics")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Room & Lab Analytics
              </button>
              <button
                className={activeTab === "rooms" ? "primary" : "secondary"}
                onClick={() => setActiveTab("rooms")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Manage Classrooms & Labs
              </button>
              <button
                className={activeTab === "courses" ? "primary" : "secondary"}
                onClick={() => setActiveTab("courses")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Manage Courses & Faculty
              </button>
              <button
                className="secondary"
                onClick={() => setShowEventModal(true)}
                style={{ fontSize: "12px", padding: "6px 12px", borderColor: "#f59e0b", color: "#d97706" }}
              >
                + Book Room for Event
              </button>
            </div>
          )}
        </div>

        {/* Export & Integration Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={downloadTimetablePNG}
            className="secondary"
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", gap: "5px" }}
            title="Download visual timetable image as PNG"
          >
            <Download size={14} /> Download PNG
          </button>
          <button
            onClick={exportGoogleCalendarIcs}
            className="secondary"
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", gap: "5px" }}
            title="Export .ics file for Google Calendar"
          >
            <CalendarCheck size={14} /> Google Calendar
          </button>
          <button
            onClick={exportToNotion}
            className="secondary"
            style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", gap: "5px" }}
            title="Copy structured Markdown for Notion table"
          >
            <FileSpreadsheet size={14} /> Connect to Notion
          </button>
        </div>
      </section>

      {/* ── TEACHER VIEW ──────────────────────────────────────────────────────── */}
      {activeRole === "teacher" && (
        <main style={{ padding: "24px" }}>
          {/* Lecturer Info Header */}
          <div
            style={{
              padding: "18px 24px",
              borderRadius: "14px",
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                FACULTY PORTAL · {currentLecturer.department}
              </span>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0" }}>
                {currentLecturer.fullName} ({currentLecturer.title})
              </h2>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                Official Email: <b>{currentLecturer.email}</b> · {assignedCoursesForTeacher.length} Assigned Course(s)
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  fontSize: "12px",
                  color: "#1d4ed8",
                }}
              >
                <b>Unavailable Slots:</b> {currentLecturer.unavailableSlots.length} registered
              </div>
              <button
                className="primary"
                onClick={() => setShowUnavailabilityModal(true)}
                style={{ fontSize: "12px", padding: "8px 14px" }}
              >
                Update My Availability
              </button>
            </div>
          </div>

          {/* Assigned Courses Strip */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>
              Assigned Courses by Admin for Confirmation
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "14px",
              }}
            >
              {assignedCoursesForTeacher.map((crs) => (
                <div
                  key={crs.id}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "var(--card-bg, #ffffff)",
                    borderLeft: `5px solid ${crs.color}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <b>{crs.code}</b>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: crs.practicalHours > 0 ? "#fdf4ff" : "#f0fdf4",
                        color: crs.practicalHours > 0 ? "#c026d3" : "#16a34a",
                        border: `1px solid ${crs.practicalHours > 0 ? "#f5d0fe" : "#bbf7d0"}`,
                      }}
                    >
                      {crs.practicalHours > 0 ? "Requires Specialized Lab" : "Theory Only"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>{crs.title}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
                    Cohort: {crs.cohort} · {crs.credits} Credits ({crs.theoryHours}h Theory + {crs.practicalHours}h
                    Practical)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timetable Grid with Swap actions */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                Weekly Schedule & Dynamic Slot Swapper
              </h3>
              <small style={{ color: "#64748b" }}>
                💡 Click on any class to swap days, change room, or convert to Online.
              </small>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px repeat(5, 1fr)",
                gap: "8px",
                overflowX: "auto",
              }}
            >
              <div />
              {DAYS.map((d) => (
                <div
                  key={d}
                  style={{
                    padding: "10px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "13px",
                    borderRadius: "8px",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  {d}
                </div>
              ))}

              {TIME_SLOTS.map((slotTime) => (
                <React.Fragment key={slotTime}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#64748b",
                      padding: "8px",
                    }}
                  >
                    {slotTime}
                  </div>

                  {DAYS.map((day) => {
                    const classSlot = teacherSlots.find((s) => s.day === day && s.timeSlot === slotTime);
                    const course = classSlot ? courses.find((c) => c.id === classSlot.courseId) : null;
                    const room = classSlot ? rooms.find((r) => r.id === classSlot.classroomId) : null;
                    const isUnavailable = currentLecturer.unavailableSlots.includes(`${day}-${slotTime}`);

                    if (classSlot && course) {
                      return (
                        <div
                          key={`${day}-${slotTime}`}
                          onClick={() => setSwapModalSlot(classSlot)}
                          style={{
                            padding: "12px",
                            borderRadius: "10px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            background: classSlot.isOnline
                              ? "rgba(16, 185, 129, 0.12)"
                              : classSlot.sessionType === "practical"
                              ? "rgba(168, 85, 247, 0.12)"
                              : "rgba(59, 130, 246, 0.12)",
                            border:
                              classSlot.status === "relocated_due_to_event"
                                ? "2px dashed #ef4444"
                                : `1px solid ${
                                    classSlot.isOnline
                                      ? "#10b981"
                                      : classSlot.sessionType === "practical"
                                      ? "#a855f7"
                                      : "#3b82f6"
                                  }`,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: "110px",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                              <b style={{ fontSize: "13px" }}>{course.code}</b>
                              <span
                                style={{
                                  fontSize: "9px",
                                  fontWeight: 700,
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  background: classSlot.isOnline ? "#059669" : "#3b82f6",
                                  color: "#fff",
                                }}
                              >
                                {classSlot.isOnline
                                  ? "ONLINE"
                                  : classSlot.sessionType === "practical"
                                  ? "LAB"
                                  : "THEORY"}
                              </span>
                            </div>
                            <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "2px" }}>{course.title}</div>
                            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>
                              Cohort: {course.cohort}
                            </div>
                          </div>

                          <div style={{ marginTop: "8px" }}>
                            <div style={{ fontSize: "11px", fontWeight: 600, color: "#1e3a8a" }}>
                              {classSlot.isOnline ? "🌐 Virtual Room" : `📍 ${room?.name}`}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                marginTop: "4px",
                                color: "#2563eb",
                              }}
                            >
                              <ArrowLeftRight size={11} /> Tap to swap slot
                            </div>
                            {classSlot.status === "relocated_due_to_event" && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#dc2626",
                                  fontWeight: 700,
                                  marginTop: "4px",
                                }}
                              >
                                ⚠ Room pre-empted by event
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isUnavailable) {
                      return (
                        <div
                          key={`${day}-${slotTime}`}
                          style={{
                            background: "rgba(239, 68, 68, 0.06)",
                            border: "1px dashed rgba(239, 68, 68, 0.3)",
                            borderRadius: "8px",
                            padding: "8px",
                            display: "grid",
                            placeItems: "center",
                            textAlign: "center",
                            fontSize: "11px",
                            color: "#ef4444",
                          }}
                        >
                          <span>Marked Unavailable</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${day}-${slotTime}`}
                        style={{
                          background: "var(--card-bg, #ffffff)",
                          border: "1px solid var(--border, #f1f5f9)",
                          borderRadius: "8px",
                          padding: "8px",
                          display: "grid",
                          placeItems: "center",
                          color: "#94a3b8",
                          fontSize: "11px",
                        }}
                      >
                        Free Slot
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── STUDENT VIEW ──────────────────────────────────────────────────────── */}
      {activeRole === "student" && (
        <main style={{ padding: "24px" }}>
          {activeTab === "schedule" ? (
            <div>
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: "12px",
                  background: "var(--card-bg, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>
                    REGISTERED COHORT SCHEDULE
                  </span>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0" }}>
                    Student: {selectedStudentId} ({studentCohort})
                  </h2>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    Academic Year 2026/2027 · Real-time synchronized with lecturer updates
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={downloadTimetablePNG} className="secondary" style={{ fontSize: "12px", padding: "6px 12px" }}>
                    <Download size={14} /> Download My PNG
                  </button>
                  <button onClick={exportGoogleCalendarIcs} className="primary" style={{ fontSize: "12px", padding: "6px 12px" }}>
                    <CalendarCheck size={14} /> Add to Phone Calendar
                  </button>
                </div>
              </div>

              {/* Student Timetable Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px repeat(5, 1fr)",
                  gap: "8px",
                  overflowX: "auto",
                }}
              >
                <div />
                {DAYS.map((d) => (
                  <div
                    key={d}
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: "13px",
                      borderRadius: "8px",
                      background: "var(--card-bg, #ffffff)",
                      border: "1px solid var(--border, #e2e8f0)",
                    }}
                  >
                    {d}
                  </div>
                ))}

                {TIME_SLOTS.map((slotTime) => (
                  <React.Fragment key={slotTime}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#64748b",
                        padding: "8px",
                      }}
                    >
                      {slotTime}
                    </div>

                    {DAYS.map((day) => {
                      const classSlot = studentSlots.find((s) => s.day === day && s.timeSlot === slotTime);
                      const course = classSlot ? courses.find((c) => c.id === classSlot.courseId) : null;
                      const room = classSlot ? rooms.find((r) => r.id === classSlot.classroomId) : null;
                      const lecturer = classSlot ? lecturers.find((l) => l.id === classSlot.lecturerId) : null;

                      if (classSlot && course) {
                        return (
                          <div
                            key={`${day}-${slotTime}`}
                            style={{
                              padding: "12px",
                              borderRadius: "10px",
                              background: classSlot.isOnline
                                ? "rgba(16, 185, 129, 0.1)"
                                : classSlot.sessionType === "practical"
                                ? "rgba(168, 85, 247, 0.1)"
                                : "rgba(59, 130, 246, 0.1)",
                              border: `1px solid ${
                                classSlot.isOnline
                                  ? "#10b981"
                                  : classSlot.sessionType === "practical"
                                  ? "#a855f7"
                                  : "#3b82f6"
                              }`,
                              minHeight: "105px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <b style={{ fontSize: "13px" }}>{course.code}</b>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    padding: "2px 5px",
                                    borderRadius: "4px",
                                    background: classSlot.isOnline ? "#059669" : "#2563eb",
                                    color: "#fff",
                                  }}
                                >
                                  {classSlot.isOnline
                                    ? "ONLINE"
                                    : classSlot.sessionType === "practical"
                                    ? "LAB"
                                    : "THEORY"}
                                </span>
                              </div>
                              <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "2px" }}>
                                {course.title}
                              </div>
                            </div>

                            <div style={{ marginTop: "6px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 600, color: "#1e3a8a" }}>
                                {classSlot.isOnline ? "🌐 Virtual Google Meet" : `📍 ${room?.name}`}
                              </div>
                              <div style={{ fontSize: "10px", color: "#64748b" }}>Lecturer: {lecturer?.fullName}</div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${day}-${slotTime}`}
                          style={{
                            background: "var(--card-bg, #ffffff)",
                            border: "1px solid var(--border, #f1f5f9)",
                            borderRadius: "8px",
                            padding: "8px",
                            display: "grid",
                            placeItems: "center",
                            color: "#cbd5e1",
                            fontSize: "11px",
                          }}
                        >
                          —
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            /* ── EXAM TIMETABLE & SEAT NUMBER VIEW ────────────────────────────── */
            <div>
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: "12px",
                  background: "var(--card-bg, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>
                      OFFICIAL EXAMINATION SCHEDULE
                    </span>
                    <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0" }}>
                      End of Semester Exam Timetable
                    </h2>
                    <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                      Exams strictly occur in 2 standard sessions: <b>Morning (09:00 - 11:30 AM)</b> and{" "}
                      <b>Afternoon (01:00 - 03:30 PM / 04:00 PM)</b>.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                      color: "#b45309",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Candidate Seat Verification: Valid Student ID Required
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {INITIAL_EXAMS.map((exam) => (
                  <div
                    key={exam.id}
                    style={{
                      padding: "20px",
                      borderRadius: "12px",
                      background: "var(--card-bg, #ffffff)",
                      border: "1px solid var(--border, #e2e8f0)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "16px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <b style={{ fontSize: "16px" }}>{exam.courseCode}</b>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: exam.session === "morning" ? "#dbeafe" : "#fef3c7",
                            color: exam.session === "morning" ? "#1e40af" : "#92400e",
                          }}
                        >
                          {exam.session === "morning" ? "Morning Session (09:00 - 11:30)" : "Afternoon Session (13:00 - 15:30)"}
                        </span>
                      </div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "4px 0" }}>{exam.courseTitle}</h3>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>
                        Date: <b>{exam.date}</b> · Venue: <b>{exam.roomName}</b> · Invigilator: {exam.invigilator}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "12px 20px",
                        borderRadius: "10px",
                        background: "#1e3a8a",
                        color: "#ffffff",
                        textAlign: "center",
                        minWidth: "160px",
                      }}
                    >
                      <small style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Your Allocated Seat
                      </small>
                      <div style={{ fontSize: "18px", fontWeight: 800, marginTop: "2px" }}>
                        {exam.seatNumber}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── ADMINISTRATOR VIEW ─────────────────────────────────────────────────── */}
      {activeRole === "admin" && (
        <main style={{ padding: "24px" }}>
          {activeTab === "schedule" && (
            <div>
              <div
                style={{
                  padding: "18px 24px",
                  borderRadius: "14px",
                  background: "var(--card-bg, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                    ADMINISTRATOR SCHEDULING DISPATCH
                  </span>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "4px 0" }}>
                    Master Institutional Timetable
                  </h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    Generate, audit, and relocate lectures & specialized laboratory sessions across all Academic City blocks.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="primary"
                    onClick={() => {
                      showToast("✓ Auto-optimizing timetable across specialized labs and lecture halls...");
                      setTimeout(() => showToast("✓ Conflict-free master timetable generated & published!"), 1200);
                    }}
                    style={{ fontSize: "12px", padding: "8px 14px", display: "inline-flex", gap: "6px" }}
                  >
                    <Sparkles size={14} /> Regenerate Optimal Schedule
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setShowEventModal(true)}
                    style={{ fontSize: "12px", padding: "8px 14px" }}
                  >
                    + Book Event in Classroom
                  </button>
                </div>
              </div>

              {/* Master Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px repeat(5, 1fr)",
                  gap: "8px",
                  overflowX: "auto",
                }}
              >
                <div />
                {DAYS.map((d) => (
                  <div
                    key={d}
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: "13px",
                      borderRadius: "8px",
                      background: "var(--card-bg, #ffffff)",
                      border: "1px solid var(--border, #e2e8f0)",
                    }}
                  >
                    {d}
                  </div>
                ))}

                {TIME_SLOTS.map((slotTime) => (
                  <React.Fragment key={slotTime}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#64748b",
                        padding: "8px",
                      }}
                    >
                      {slotTime}
                    </div>

                    {DAYS.map((day) => {
                      const daySlots = slots.filter((s) => s.day === day && s.timeSlot === slotTime);
                      const events = eventBookings.filter((e) => e.day === day && e.timeSlot === slotTime);

                      return (
                        <div
                          key={`${day}-${slotTime}`}
                          style={{
                            background: "var(--card-bg, #ffffff)",
                            border: "1px solid var(--border, #e2e8f0)",
                            borderRadius: "8px",
                            padding: "8px",
                            minHeight: "110px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {events.map((ev) => (
                            <div
                              key={ev.id}
                              style={{
                                padding: "4px 6px",
                                borderRadius: "4px",
                                background: "#fef3c7",
                                border: "1px solid #fde68a",
                                color: "#92400e",
                                fontSize: "10px",
                                fontWeight: 700,
                              }}
                            >
                              ★ Event: {ev.title} ({rooms.find((r) => r.id === ev.classroomId)?.code})
                            </div>
                          ))}

                          {daySlots.map((s) => {
                            const c = courses.find((x) => x.id === s.courseId);
                            const r = rooms.find((x) => x.id === s.classroomId);
                            return (
                              <div
                                key={s.id}
                                onClick={() => setSwapModalSlot(s)}
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  background: s.isOnline
                                    ? "#ecfdf5"
                                    : s.sessionType === "practical"
                                    ? "#faf5ff"
                                    : "#eff6ff",
                                  border: `1px solid ${
                                    s.isOnline ? "#a7f3d0" : s.sessionType === "practical" ? "#e9d5ff" : "#bfdbfe"
                                  }`,
                                  fontSize: "11px",
                                }}
                              >
                                <b>{c?.code}</b> · {s.isOnline ? "Online" : r?.code}
                              </div>
                            );
                          })}

                          {daySlots.length === 0 && events.length === 0 && (
                            <div
                              style={{
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                                color: "#cbd5e1",
                                fontSize: "11px",
                              }}
                            >
                              Open Slot
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ── ADMIN ANALYTICS TAB ────────────────────────────────────────────── */}
          {activeTab === "analytics" && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <small style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                    Active Rooms in Use
                  </small>
                  <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px", color: "#2563eb" }}>
                    {new Set(slots.filter((s) => !s.isOnline).map((s) => s.classroomId)).size} / {rooms.length}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Physical halls currently allocated
                  </p>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <small style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                    Specialized Lab Utilization
                  </small>
                  <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px", color: "#9333ea" }}>
                    78.4%
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Robotics, AI & Digital Circuits occupancy
                  </p>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <small style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                    Online Classes Ratio
                  </small>
                  <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px", color: "#059669" }}>
                    {Math.round((slots.filter((s) => s.isOnline).length / Math.max(1, slots.length)) * 100)}%
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Freeing up on-campus space
                  </p>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <small style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                    Assigned Faculty (@acity.edu.gh)
                  </small>
                  <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "6px", color: "#0f172a" }}>
                    {lecturers.length}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                    100% active institutional faculty
                  </p>
                </div>
              </div>

              {/* Classroom Utilization Table */}
              <div
                style={{
                  padding: "20px",
                  borderRadius: "14px",
                  background: "var(--card-bg, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>
                  Classroom Capacity vs Scheduled Classes
                </h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  {rooms.map((room) => {
                    const roomSlots = slots.filter((s) => s.classroomId === room.id && !s.isOnline);
                    const usagePercent = Math.min(100, Math.round((roomSlots.length / 20) * 100));
                    return (
                      <div
                        key={room.id}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: "1px solid var(--border, #e2e8f0)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div style={{ minWidth: "220px" }}>
                          <b>{room.name}</b> ({room.code})
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            Capacity: {room.capacity} seats · Type: {room.type.replace("_", " ")}
                          </div>
                        </div>

                        <div style={{ flex: 1, maxWidth: "300px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                            <span>Usage: {roomSlots.length} periods/wk</span>
                            <span>{usagePercent}%</span>
                          </div>
                          <div
                            style={{
                              height: "6px",
                              borderRadius: "3px",
                              background: "#e2e8f0",
                              overflow: "hidden",
                              marginTop: "4px",
                            }}
                          >
                            <div
                              style={{
                                width: `${usagePercent}%`,
                                height: "100%",
                                background: usagePercent > 70 ? "#ef4444" : "#3b82f6",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── ADMIN ROOMS MANAGEMENT TAB ──────────────────────────────────────── */}
          {activeTab === "rooms" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                  Manage Classrooms & Specialized Laboratories
                </h3>
                <button
                  className="primary"
                  onClick={() => setShowAddRoomModal(true)}
                  style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", gap: "6px" }}
                >
                  <Plus size={14} /> Add New Facility
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "var(--card-bg, #ffffff)",
                      border: "1px solid var(--border, #e2e8f0)",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              room.type === "specialized_lab"
                                ? "#f3e8ff"
                                : room.type === "lecture_hall"
                                ? "#dbeafe"
                                : "#f1f5f9",
                            color:
                              room.type === "specialized_lab"
                                ? "#7e22ce"
                                : room.type === "lecture_hall"
                                ? "#1e40af"
                                : "#475569",
                          }}
                        >
                          {room.type.replace("_", " ").toUpperCase()}
                        </span>
                        <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "6px 0 2px" }}>{room.name}</h4>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          Code: {room.code} · Building: {room.building}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", fontSize: "12px", color: "#334155" }}>
                      Capacity: <b>{room.capacity} Students</b>
                    </div>

                    {room.specialtyEquipment && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "8px",
                          borderRadius: "6px",
                          background: "#faf5ff",
                          border: "1px solid #f3e8ff",
                          fontSize: "11px",
                          color: "#6b21a8",
                        }}
                      >
                        <b>Specialized Hardware:</b> {room.specialtyEquipment}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "12px" }}>
                      <button
                        onClick={() => {
                          setRooms((prev) => prev.filter((r) => r.id !== room.id));
                          showToast(`✓ Removed ${room.name}`);
                        }}
                        style={{
                          padding: "4px 8px",
                          background: "#fee2e2",
                          color: "#dc2626",
                          border: 0,
                          borderRadius: "6px",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ADMIN COURSES & FACULTY MANAGEMENT TAB ──────────────────────────── */}
          {activeTab === "courses" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                  Course Syllabus & Faculty (@acity.edu.gh)
                </h3>
                <button
                  className="primary"
                  onClick={() => setShowAddCourseModal(true)}
                  style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", gap: "6px" }}
                >
                  <Plus size={14} /> Add New Course
                </button>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {courses.map((course) => {
                  const assignedLec = lecturers.find((l) => l.id === course.assignedLecturerId);
                  return (
                    <div
                      key={course.id}
                      style={{
                        padding: "16px 20px",
                        borderRadius: "10px",
                        background: "var(--card-bg, #ffffff)",
                        border: "1px solid var(--border, #e2e8f0)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <b style={{ fontSize: "15px" }}>{course.code}</b>
                          <span>—</span>
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>{course.title}</span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: course.practicalHours > 0 ? "#fdf4ff" : "#f0fdf4",
                              color: course.practicalHours > 0 ? "#9333ea" : "#16a34a",
                            }}
                          >
                            {course.practicalHours > 0
                              ? `Requires ${course.practicalHours}h Specialized Lab`
                              : "Standard Theory Room"}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                          Cohort: {course.cohort} · Enrollment: {course.enrolledStudents} students · Credits:{" "}
                          {course.credits}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700 }}>
                            {assignedLec?.fullName || "Unassigned"}
                          </div>
                          <div style={{ fontSize: "11px", color: "#2563eb" }}>
                            {assignedLec?.email || "Assign lecturer"}
                          </div>
                        </div>

                        <select
                          value={course.assignedLecturerId}
                          onChange={(e) => {
                            const newLecId = e.target.value;
                            setCourses((prev) =>
                              prev.map((c) => (c.id === course.id ? { ...c, assignedLecturerId: newLecId } : c))
                            );
                            setSlots((prev) =>
                              prev.map((s) => (s.courseId === course.id ? { ...s, lecturerId: newLecId } : s))
                            );
                            const lec = lecturers.find((l) => l.id === newLecId);
                            showToast(`✓ Assigned ${course.code} to ${lec?.fullName}`);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "12px",
                          }}
                        >
                          {lecturers.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.fullName} ({l.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── MODAL: TEACHER SLOT SWAP & ONLINE CONVERSION ───────────────────────── */}
      {swapModalSlot && (
        <div
          className="modal-backdrop"
          onClick={() => setSwapModalSlot(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                  SMART SCHEDULE OPTIMIZER
                </span>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "2px 0" }}>
                  Swap / Reschedule Class Session
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                  {courses.find((c) => c.id === swapModalSlot.courseId)?.code} — Currently {swapModalSlot.day} (
                  {swapModalSlot.timeSlot})
                </p>
              </div>
              <button
                onClick={() => setSwapModalSlot(null)}
                style={{ background: "none", border: 0, cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Constraint indicator */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: swapModalSlot.sessionType === "practical" ? "#faf5ff" : "#eff6ff",
                border: `1px solid ${swapModalSlot.sessionType === "practical" ? "#e9d5ff" : "#bfdbfe"}`,
                fontSize: "12px",
                color: swapModalSlot.sessionType === "practical" ? "#7e22ce" : "#1e40af",
                marginBottom: "16px",
              }}
            >
              <b>Requirement:</b>{" "}
              {swapModalSlot.sessionType === "practical"
                ? "This is a Practical Lab course. Only available Specialized Labs with vacancy are displayed below."
                : "This is a Theory session. Standard classrooms or lecture halls with matching capacity are shown."}
            </div>

            {/* Quick Option 1: Switch to Online Mode */}
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div>
                <b style={{ color: "#065f46", fontSize: "13px" }}>Switch Session to Online Mode</b>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#047857" }}>
                  Freed up on-campus classroom space immediately for institutional events or other classes.
                </p>
              </div>
              <button
                className="primary"
                onClick={() =>
                  executeSlotSwap(
                    swapModalSlot.id,
                    swapModalSlot.day,
                    swapModalSlot.timeSlot,
                    swapModalSlot.classroomId,
                    true
                  )
                }
                style={{ background: "#059669", fontSize: "12px", padding: "8px 12px", whiteSpace: "nowrap" }}
              >
                Opt for Online Class
              </button>
            </div>

            {/* Option 2: Available Vacant Slots */}
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>
                Conflict-Free Swap Opportunities ({availableSwapDestinations.length} available)
              </h4>

              {availableSwapDestinations.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#64748b", fontSize: "13px" }}>
                  No free slots found matching your availability and room requirements. Try marking more free days or
                  switching to Online.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                  {availableSwapDestinations.slice(0, 8).map((dest, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #cbd5e1)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--card-bg, #ffffff)",
                      }}
                    >
                      <div>
                        <b>
                          {dest.day} · {dest.timeSlot}
                        </b>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          Venue: <b>{dest.room.name}</b> ({dest.room.type.replace("_", " ")}) · Cap:{" "}
                          {dest.room.capacity}
                        </div>
                      </div>

                      <button
                        className="secondary"
                        onClick={() =>
                          executeSlotSwap(swapModalSlot.id, dest.day, dest.timeSlot, dest.room.id, false)
                        }
                        style={{ fontSize: "11px", padding: "5px 10px" }}
                      >
                        Swap to Here
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TEACHER UNAVAILABILITY SELECTOR ─────────────────────────────── */}
      {showUnavailabilityModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowUnavailabilityModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "16px",
              maxWidth: "540px",
              width: "100%",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
                  Mark Free & Unavailable Days
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Select periods when you are NOT available (research, conferences, off-campus).
                </p>
              </div>
              <button
                onClick={() => setShowUnavailabilityModal(false)}
                style={{ background: "none", border: 0, cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gap: "10px", margin: "16px 0" }}>
              {DAYS.map((d) => (
                <div key={d} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <b style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}>{d}</b>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {TIME_SLOTS.map((t) => {
                      const isUnavail = currentLecturer.unavailableSlots.includes(`${d}-${t}`);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleUnavailableSlot(d, t)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: `1px solid ${isUnavail ? "#ef4444" : "#cbd5e1"}`,
                            background: isUnavail ? "#fee2e2" : "#ffffff",
                            color: isUnavail ? "#b91c1c" : "#334155",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {t} {isUnavail ? "✕ Busy" : "✓ Free"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="primary" onClick={() => setShowUnavailabilityModal(false)} style={{ fontSize: "12px" }}>
                Done & Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADMIN BOOK ROOM FOR EVENT ──────────────────────────────────── */}
      {showEventModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowEventModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as any;
              bookClassroomForEvent(
                form.title.value,
                form.classroomId.value,
                form.day.value,
                form.timeSlot.value,
                form.description.value
              );
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "16px",
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px" }}>
              Book Classroom for Institutional Event
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
              If a class is scheduled in this room, the lecturer will be alerted to reassign.
            </p>

            <div style={{ display: "grid", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Event Title
                <input
                  name="title"
                  required
                  placeholder="e.g. Academic City Tech Expo / Faculty Senate"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                />
              </label>

              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Venue / Classroom
                <select
                  name="classroomId"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type.replace("_", " ")}) - Cap: {r.capacity}
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Day
                  <select
                    name="day"
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Time Slot
                  <select
                    name="timeSlot"
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Description / Notes
                <textarea
                  name="description"
                  placeholder="Details for faculty & students"
                  rows={2}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" className="secondary" onClick={() => setShowEventModal(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Book Room & Notify
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: ADMIN ADD COURSE ───────────────────────────────────────────── */}
      {showAddCourseModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddCourseModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as any;
              const newCourse: Course = {
                id: `crs-${Date.now()}`,
                code: form.code.value.trim().toUpperCase(),
                title: form.title.value.trim(),
                department: form.department.value,
                cohort: form.cohort.value,
                enrolledStudents: Number(form.enrolledStudents.value) || 30,
                credits: Number(form.credits.value) || 3,
                theoryHours: Number(form.theoryHours.value) || 2,
                practicalHours: Number(form.practicalHours.value) || 0,
                assignedLecturerId: form.assignedLecturerId.value,
                color: "#2563eb",
              };
              setCourses((prev) => [...prev, newCourse]);
              showToast(`✓ Added course ${newCourse.code}`);
              setShowAddCourseModal(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "16px",
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>Add New Academic Course</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Course Code
                  <input name="code" required placeholder="e.g. CSCD 412" style={{ width: "100%", padding: "6px" }} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Course Title
                  <input name="title" required placeholder="e.g. Distributed Systems" style={{ width: "100%", padding: "6px" }} />
                </label>
              </div>

              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Cohort (Student Group)
                <input name="cohort" required placeholder="e.g. Level 400 CS" style={{ width: "100%", padding: "6px" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Theory Hours/Wk
                  <input name="theoryHours" type="number" defaultValue="2" style={{ width: "100%", padding: "6px" }} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Practical Hours/Wk (Lab)
                  <input name="practicalHours" type="number" defaultValue="2" style={{ width: "100%", padding: "6px" }} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Credits
                  <input name="credits" type="number" defaultValue="3" style={{ width: "100%", padding: "6px" }} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Class Size
                  <input name="enrolledStudents" type="number" defaultValue="35" style={{ width: "100%", padding: "6px" }} />
                </label>
              </div>

              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Department
                <input name="department" defaultValue="Computer Science" style={{ width: "100%", padding: "6px" }} />
              </label>

              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Assign Faculty Lecturer (@acity.edu.gh)
                <select name="assignedLecturerId" style={{ width: "100%", padding: "6px" }}>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName} ({l.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button type="button" className="secondary" onClick={() => setShowAddCourseModal(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Save Course
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: ADMIN ADD ROOM / LAB ───────────────────────────────────────── */}
      {showAddRoomModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddRoomModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as any;
              const newRoom: Classroom = {
                id: `room-${Date.now()}`,
                name: form.name.value.trim(),
                code: form.code.value.trim().toUpperCase(),
                type: form.type.value as RoomType,
                capacity: Number(form.capacity.value) || 40,
                building: form.building.value.trim(),
                specialtyEquipment: form.specialtyEquipment.value.trim() || undefined,
              };
              setRooms((prev) => [...prev, newRoom]);
              showToast(`✓ Added facility ${newRoom.name}`);
              setShowAddRoomModal(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "16px",
              maxWidth: "460px",
              width: "100%",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>Add Classroom or Specialized Lab</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Facility Name
                <input name="name" required placeholder="e.g. Embedded AI Laboratory" style={{ width: "100%", padding: "6px" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Room Code
                  <input name="code" required placeholder="e.g. AI-LAB-2" style={{ width: "100%", padding: "6px" }} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>
                  Capacity
                  <input name="capacity" type="number" defaultValue="40" style={{ width: "100%", padding: "6px" }} />
                </label>
              </div>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Type
                <select name="type" style={{ width: "100%", padding: "6px" }}>
                  <option value="specialized_lab">Specialized Laboratory (For practicals)</option>
                  <option value="lecture_hall">Lecture Hall (For theory)</option>
                  <option value="standard_classroom">Standard Classroom</option>
                </select>
              </label>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Building
                <input name="building" defaultValue="Innovation Hub" style={{ width: "100%", padding: "6px" }} />
              </label>
              <label style={{ fontSize: "12px", fontWeight: 600 }}>
                Specialized Hardware / Equipment (if lab)
                <textarea name="specialtyEquipment" placeholder="e.g. Microcontroller kits, GPUs, 3D printers" rows={2} style={{ width: "100%", padding: "6px" }} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button type="button" className="secondary" onClick={() => setShowAddRoomModal(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Create Facility
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} color="#4ade80" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

