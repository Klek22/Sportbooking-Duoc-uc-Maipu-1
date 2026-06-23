export type FieldId = 'cancha-1' | 'cancha-2' | 'padel-1' | 'padel-2';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'student' | 'admin';
  isVip: boolean;
  experience: {
    futbol: 'principiante' | 'intermedio' | 'avanzado';
    padel: 'principiante' | 'intermedio' | 'avanzado';
  };
}

export interface Booking {
  id: string;
  fieldId: FieldId;
  userId: string;
  userName: string;
  participants: string[]; // List of names or emails
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled';
  bookingType?: 'regular' | 'friendly' | 'tournament';
  paymentMethod: 'efectivo' | 'transferencia';
  paymentStatus: 'pendiente' | 'completado' | 'esperando_validacion';
  receiptUrl?: string;
  isVipBooking: boolean;
  price: number;
  createdAt: string;
}

export interface FriendlyMatch {
  id: string;
  sport: 'futbol' | 'padel';
  level: 'principiante' | 'intermedio' | 'avanzado';
  date: string;
  fieldId: FieldId;
  organizerId: string;
  participants: string[];
  maxParticipants: number;
  isPrivate?: boolean;
  isVip?: boolean;
  status: 'open' | 'full' | 'completed';
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  startDate: string;
  endDate: string;
  teams: Team[];
  matches: Match[];
  status: 'upcoming' | 'ongoing' | 'completed';
}

export interface Team {
  id: string;
  name: string;
  players: string[]; // User IDs
}

export interface Match {
  id: string;
  teamAId: string;
  teamBId: string;
  scoreA?: number;
  scoreB?: number;
  date: string;
  fieldId: FieldId;
  status: 'pending' | 'completed';
}

export interface EquipmentRequest {
  id: string;
  userId: string;
  userName: string;
  bookingId?: string;
  items: {
    type: 'pelota-futbol' | 'paleta-padel' | 'pelota-padel';
    quantity: number;
  }[];
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  isVip?: boolean;
  createdAt: string;
}

export interface Feedback {
  id: string;
  userId: string;
  userName: string;
  type: 'review' | 'complaint';
  rating?: number; // 1-5 for reviews
  comment: string;
  status: 'pending' | 'resolved' | 'ignored';
  isVip?: boolean;
  createdAt: string;
}
