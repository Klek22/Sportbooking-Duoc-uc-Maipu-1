/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Booking, Tournament, FieldId, FriendlyMatch, Match } from './types';
import { 
  Calendar, 
  Trophy, 
  Users, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  Clock, 
  MapPin,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  Trash2,
  Package,
  Dribbble,
  Gamepad2,
  CircleDot,
  History,
  Star,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Banknote,
  Smartphone,
  QrCode,
  Share2,
  Copy,
  X
} from 'lucide-react';
import { format, addHours, startOfHour, isAfter, isBefore, startOfDay, endOfDay, addDays, subDays, getDay, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';
import { EquipmentRequest, Feedback } from './types';

// --- Context ---
interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  signIn: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isQrOpen: boolean;
  setIsQrOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = (firebaseUser.email || '').toLowerCase();
        const isDuoc = email.endsWith('@duocuc.cl');

        if (!isDuoc) {
          setAuthError('Ingresa con tu correo institucional');
          setUser(null);
          await signOut(auth);
          setLoading(false);
          return;
        }

        setAuthError(null);
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          // Force admin role only for the specific email
          const updatedUser = {
            ...userData,
            role: (firebaseUser.email === 'bor.pavez@duocuc.cl') ? 'admin' : 'student'
          } as User;
          setUser(updatedUser);
        } else {
          const newUser: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Usuario',
            photoURL: firebaseUser.photoURL || undefined,
            role: (firebaseUser.email === 'bor.pavez@duocuc.cl') ? 'admin' : 'student',
            isVip: (firebaseUser.email === 'bor.pavez@duocuc.cl'),
            experience: {
              futbol: 'principiante',
              padel: 'principiante',
            },
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
      toast.error('Error al iniciar sesión');
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    try {
      setAuthError(null);
      const trimmedEmail = email.trim().toLowerCase();
      const isDuoc = trimmedEmail.endsWith('@duocuc.cl');
      if (!isDuoc) {
        setAuthError('Ingresa con tu correo institucional');
        toast.error('Ingresa con tu correo institucional');
        throw new Error('CORREO_NO_INSTITUCIONAL');
      }

      await signInWithEmailAndPassword(auth, email, pass);
      // Reset failed attempts on success
      const attemptRef = doc(db, 'failed_attempts', email);
      await setDoc(attemptRef, { count: 0 }, { merge: true });
    } catch (error: any) {
      if (error.message === 'CORREO_NO_INSTITUCIONAL') {
        throw error;
      }
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        const attemptRef = doc(db, 'failed_attempts', email);
        const attemptDoc = await getDoc(attemptRef);
        const currentCount = attemptDoc.exists() ? attemptDoc.data().count : 0;
        const newCount = currentCount + 1;
        
        await setDoc(attemptRef, { count: newCount, lastAttempt: Timestamp.now() }, { merge: true });
        
        if (newCount >= 10) {
          toast.error('Demasiados intentos fallidos. Revisa tu correo para recuperar tu contraseña.');
          await sendPasswordResetEmail(auth, email);
          throw new Error('TOO_MANY_ATTEMPTS');
        } else {
          toast.error(`Contraseña incorrecta. Intentos: ${newCount}/10`);
        }
      } else {
        toast.error('Error al iniciar sesión');
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Correo de recuperación enviado');
    } catch (error) {
      toast.error('Error al enviar correo de recuperación');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, setAuthError, signIn, signInEmail, resetPassword, logout, isQrOpen, setIsQrOpen }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// --- Constants ---
const COURT_PRICES = {
  'cancha-1': 15000, // VIP Exclusive
  'cancha-2': 15000,
  'padel-1': 10000,
  'padel-2': 10000,
};

const EQUIPMENT_PRICE = 2500;
const VIP_DISCOUNT = 0.20; // 20% discount

// --- Components ---

function VIPBadge({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-600 text-black text-[10px] font-black uppercase tracking-wider shadow-sm",
      className
    )}>
      <Star className="h-2.5 w-2.5 fill-black" />
      VIP
    </div>
  );
}

function Navbar() {
  const { user, logout, setIsQrOpen } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-black shadow-sm">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">Duoc UC Maipú</h1>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Deportes</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="flex items-center justify-end gap-2">
                {user.isVip && <VIPBadge />}
                <p className="text-sm font-semibold text-zinc-900">{user.displayName}</p>
              </div>
              <p className="text-xs text-zinc-500">{user.role === 'admin' ? 'Administrador' : 'Alumno'}</p>
            </div>
            <button
              onClick={() => setIsQrOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-600 border border-zinc-100 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              title="Compartir Aplicación (Código QR)"
            >
              <QrCode className="h-5 w-5" />
            </button>
            <button
              onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function FieldBooking() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'calendar' | 'history'>('calendar');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userHistory, setUserHistory] = useState<Booking[]>([]);
  const [selectedField, setSelectedField] = useState<FieldId>('cancha-1');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [participants, setParticipants] = useState<string>('');
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [isVipBooking, setIsVipBooking] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<{ type: string, quantity: number }[]>([]);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      return;
    }
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);

    const q = query(
      collection(db, 'bookings'),
      where('startTime', '>=', Timestamp.fromDate(start)),
      where('startTime', '<=', Timestamp.fromDate(end)),
      where('status', '==', 'confirmed')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: (doc.data().startTime as Timestamp).toDate().toISOString(),
        endTime: (doc.data().endTime as Timestamp).toDate().toISOString(),
      })) as Booking[];
      setBookings(docs);
    }, (error) => {
      console.error("Error fetching bookings:", error);
    });

    return unsubscribe;
  }, [selectedDate, user]);

  useEffect(() => {
    if (!user) {
      setUserHistory([]);
      return;
    }
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: (doc.data().startTime as Timestamp).toDate().toISOString(),
        endTime: (doc.data().endTime as Timestamp).toDate().toISOString(),
      })) as Booking[];
      setUserHistory(docs);
    }, (error) => {
      console.error("Error fetching user history:", error);
    });
    return unsubscribe;
  }, [user]);

  const timeSlots = Array.from({ length: 14 }, (_, i) => {
    const date = startOfDay(selectedDate);
    date.setHours(8 + i);
    return date;
  });

  const handleBooking = async (passedReceiptImage?: string | any) => {
    if (!user || !selectedSlot) return;

    // Validate participants format
    if (participants.trim() !== '') {
      const participantsRegex = /^([^,]+)(,[^,]+)*$/;
      if (!participantsRegex.test(participants.trim())) {
        setParticipantsError('Usa comas para separar los nombres (ej: Juan, Diego)');
        return;
      }
    }
    setParticipantsError(null);

    const currentReceipt = (typeof passedReceiptImage === 'string') ? passedReceiptImage : receiptImage;

    try {
      const startTime = selectedSlot;
      const endTime = addHours(selectedSlot, 1);
      const dayOfWeek = getDay(startTime);
      const hour = getHours(startTime);

      // Availability rules
      const isSunday = dayOfWeek === 0;
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isMorning = hour >= 8 && hour < 12;
      const isFootballField = selectedField.includes('cancha');

      if (selectedField === 'cancha-1' && !user.isVip) {
        const isMoreThan24Hours = isAfter(startTime, addHours(new Date(), 24));
        if (isMoreThan24Hours) {
          toast.error('La Cancha 1 tiene prioridad VIP. Solo puedes reservarla con menos de 24 horas de anticipación.');
          return;
        }
      }

      if (isSunday || (isWeekday && isMorning && isFootballField)) {
        toast.error('Este horario no está disponible para reservas');
        return;
      }

      // Check if slot is already taken
      const isTaken = bookings.some(b => 
        b.fieldId === selectedField && 
        new Date(b.startTime).getTime() === startTime.getTime()
      );

      if (isTaken) {
        toast.error('Este horario ya está reservado');
        return;
      }

      if (paymentMethod === 'transferencia' && !currentReceipt) {
        toast.error('Por favor, selecciona el comprobante de transferencia');
        return;
      }

      setIsUploading(true);

      const basePrice = user.isVip ? COURT_PRICES[selectedField] * (1 - VIP_DISCOUNT) : COURT_PRICES[selectedField];
      const equipmentPrice = selectedEquipment.length > 0 ? EQUIPMENT_PRICE : 0;

      const bookingRef = await addDoc(collection(db, 'bookings'), {
        fieldId: selectedField,
        userId: user.uid,
        userName: user.displayName,
        participants: participants.split(',').map(p => p.trim()).filter(p => p !== ''),
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        status: 'confirmed',
        paymentMethod,
        paymentStatus: paymentMethod === 'transferencia' ? 'esperando_validacion' : 'pendiente',
        receiptUrl: currentReceipt || null,
        isVipBooking: user.isVip,
        price: basePrice + equipmentPrice,
        bookingType: 'regular',
        createdAt: Timestamp.now(),
      });

      // If equipment was selected, create an equipment request linked to this booking
      if (selectedEquipment.length > 0) {
        await addDoc(collection(db, 'equipmentRequests'), {
          userId: user.uid,
          userName: user.displayName,
          bookingId: bookingRef.id,
          items: selectedEquipment,
          status: 'pending',
          isVip: user.isVip,
          createdAt: Timestamp.now(),
        });
      }

      // Send email notification
      try {
        const body = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #facc15; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #000;">Reserva Confirmada</h1>
            </div>
            <div style="padding: 24px; color: #374151;">
              <p>Hola <strong>${user.displayName}</strong>,</p>
              <p>Tu reserva en <strong>Duoc UC Maipú Deportes</strong> ha sido registrada con éxito.</p>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Detalles:</strong></p>
                <p style="margin: 4px 0;">Cancha: ${selectedField.includes('cancha') ? `Fútbol ${selectedField.split('-')[1]}` : `Padel ${selectedField.split('-')[1]}`}</p>
                <p style="margin: 4px 0;">Fecha: ${format(selectedDate, "d 'de' MMMM", { locale: es })}</p>
                <p style="margin: 4px 0;">Hora: ${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}</p>
                <p style="margin: 4px 0;">Método de Pago: ${paymentMethod === 'transferencia' ? 'Transferencia (Pendiente validación)' : 'Efectivo (Pagar en sede)'}</p>
                <p style="margin: 4px 0; font-size: 1.2em; color: #000;"><strong>Total: $${(basePrice + equipmentPrice).toLocaleString()}</strong></p>
              </div>
              <p>Recuerda llegar 5 minutos antes de tu hora reservada.</p>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #6b7280; text-align: center;">Este es un correo automático, por favor no respondas.</p>
            </div>
          </div>
        `;

        await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: `Reserva Duoc Deportes: ${format(selectedDate, "d/MM")} ${format(startTime, 'HH:mm')}`,
            body,
          }),
        });
      } catch (err) {
        console.error('Error sending confirmation email:', err);
      }

      toast.success('Reserva realizada con éxito' + (selectedEquipment.length > 0 ? ' y solicitud de implementos enviada' : ''));
      setIsBookingModalOpen(false);
      setParticipants('');
      setParticipantsError(null);
      setIsVipBooking(false);
      setSelectedEquipment([]);
      setReceiptImage(null);
    } catch (error) {
      console.error('Error booking:', error);
      toast.error('Error al realizar la reserva');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex p-1 bg-zinc-100 rounded-xl mr-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === 'calendar' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              )}
            >
              Calendario
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === 'history' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              )}
            >
              Mi Historial
            </button>
          </div>

          {viewMode === 'calendar' && (
            <>
              <button 
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="p-2 rounded-lg hover:bg-zinc-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="text-center min-w-[150px]">
                <h2 className="text-lg font-bold text-zinc-900">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-2 rounded-lg hover:bg-zinc-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {viewMode === 'calendar' && (
          <div className="flex flex-wrap gap-1 p-1 bg-zinc-100 rounded-xl">
            {(['cancha-1', 'cancha-2', 'padel-1', 'padel-2'] as FieldId[]).map((field) => (
              <button
                key={field}
                onClick={() => setSelectedField(field)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                  selectedField === field 
                    ? "bg-white text-zinc-900 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {field.includes('cancha') ? `Fútbol ${field.split('-')[1]}` : `Padel ${field.split('-')[1]}`}
                {field === 'cancha-1' && <VIPBadge className="scale-75 origin-left" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {timeSlots.map((slot) => {
            const booking = bookings.find(b => 
              b.fieldId === selectedField && 
              new Date(b.startTime).getTime() === slot.getTime()
            );
            const isPast = isBefore(slot, startOfHour(new Date()));
            
            // Availability rules
            const dayOfWeek = getDay(slot);
            const hour = getHours(slot);
            const isSunday = dayOfWeek === 0;
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
            const isMorning = hour >= 8 && hour < 12;
            const isFootballField = selectedField.includes('cancha');
            
            const isClosed = isSunday || (isWeekday && isMorning && isFootballField);

            return (
              <motion.button
                key={slot.toISOString()}
                whileHover={!booking && !isPast && !isClosed ? { scale: 1.02 } : {}}
                whileTap={!booking && !isPast && !isClosed ? { scale: 0.98 } : {}}
                disabled={!!booking || isPast || isClosed}
                onClick={() => {
                  setSelectedSlot(slot);
                  setIsBookingModalOpen(true);
                }}
                className={cn(
                  "relative flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                  (booking || isClosed)
                    ? "bg-zinc-50 border-zinc-200 opacity-75 cursor-not-allowed" 
                    : isPast
                    ? "bg-zinc-50 border-transparent opacity-50 cursor-not-allowed"
                    : "bg-white border-zinc-200 hover:border-yellow-400 hover:shadow-md cursor-pointer"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    (booking || isClosed) ? "bg-zinc-200" : "bg-yellow-50 text-yellow-600"
                  )}>
                    {isClosed ? <AlertCircle className="h-5 w-5 text-zinc-400" /> : <Clock className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">
                      {format(slot, 'HH:mm')} - {format(addHours(slot, 1), 'HH:mm')}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-500">
                        {booking 
                          ? `Reservado por ${booking.userName}` 
                          : isClosed 
                          ? (isSunday ? 'Cerrado (Domingo)' : 'Mantenimiento/Clases') 
                          : isPast 
                          ? 'Horario pasado' 
                          : 'Disponible'}
                      </p>
                      {booking?.bookingType && booking.bookingType !== 'regular' && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                          booking.bookingType === 'friendly' ? "bg-blue-100 text-blue-600" : "bg-yellow-100 text-yellow-600"
                        )}>
                          {booking.bookingType === 'friendly' ? 'Amistoso' : 'Torneo'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!booking && !isPast && <Plus className="h-5 w-5 text-zinc-400" />}
                {booking && <CheckCircle2 className="h-5 w-5 text-zinc-400" />}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Fecha/Hora</th>
                  <th className="px-6 py-4">Cancha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {userHistory.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-900">{format(new Date(b.startTime), "d 'de' MMMM, HH:mm", { locale: es })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                        {b.fieldId.includes('cancha') ? `Fútbol ${b.fieldId.split('-')[1]}` : `Padel ${b.fieldId.split('-')[1]}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        b.bookingType === 'friendly' ? "bg-blue-100 text-blue-600" :
                        b.bookingType === 'tournament' ? "bg-yellow-100 text-yellow-600" :
                        "bg-zinc-100 text-zinc-600"
                      )}>
                        {b.bookingType || 'Regular'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        b.status === 'confirmed' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}>
                        {b.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                        b.paymentStatus === 'completado' ? "bg-green-100 text-green-600" : 
                        b.paymentStatus === 'esperando_validacion' ? "bg-yellow-100 text-yellow-600" :
                        "bg-red-100 text-red-600"
                      )}>
                        {b.paymentStatus === 'esperando_validacion' ? 'Validando' : b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {userHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-medium">
                      No tienes historial de reservas aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">Confirmar Reserva</h3>
              <p className="text-zinc-500 mb-6">
                Estás a punto de reservar la <span className="font-semibold text-zinc-900">
                  {selectedField.includes('cancha') ? `Cancha de Fútbol ${selectedField.split('-')[1]}` : `Cancha de Padel ${selectedField.split('-')[1]}`}
                </span> para el día {format(selectedDate, "d 'de' MMMM", { locale: es })} a las {selectedSlot && format(selectedSlot, 'HH:mm')}.
              </p>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Precio Base</span>
                    <span className="text-sm font-bold text-zinc-900">${COURT_PRICES[selectedField].toLocaleString()}</span>
                  </div>
                  {user?.isVip && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-xs font-bold uppercase tracking-wider">Descuento VIP (20%)</span>
                      <span className="text-sm font-bold">-${(COURT_PRICES[selectedField] * VIP_DISCOUNT).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedEquipment.length > 0 && (
                    <div className="flex justify-between items-center text-zinc-600">
                      <span className="text-xs font-bold uppercase tracking-wider">Arriendo Implementos</span>
                      <span className="text-sm font-bold">+${EQUIPMENT_PRICE.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-zinc-200 flex justify-between items-center">
                    <span className="text-sm font-black text-zinc-900 uppercase tracking-wider">Total a Pagar</span>
                    <span className="text-xl font-black text-zinc-900">
                      ${(
                        (user?.isVip ? COURT_PRICES[selectedField] * (1 - VIP_DISCOUNT) : COURT_PRICES[selectedField]) + 
                        (selectedEquipment.length > 0 ? EQUIPMENT_PRICE : 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Participantes (separados por coma)</label>
                  <input
                    type="text"
                    value={participants}
                    onChange={e => {
                      setParticipants(e.target.value);
                      if (participantsError) setParticipantsError(null);
                    }}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl border focus:outline-none focus:ring-2",
                      participantsError 
                        ? "border-red-300 focus:ring-red-400" 
                        : "border-zinc-200 focus:ring-yellow-400"
                    )}
                    placeholder="Ej: Juan Perez, Diego Soto"
                  />
                  {participantsError && (
                    <p className="mt-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">
                      {participantsError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Implementos (Opcional)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'pelota-futbol', name: 'Pelota de Fútbol', icon: <Dribbble className="h-4 w-4" /> },
                      { id: 'paleta-padel', name: 'Paleta de Padel', icon: <CircleDot className="h-4 w-4" /> },
                      { id: 'pelota-padel', name: 'Pelota de Padel', icon: <CircleDot className="h-4 w-4" /> },
                    ].filter(item => {
                      if (selectedField.includes('cancha')) return item.id === 'pelota-futbol';
                      return item.id.includes('padel');
                    }).map((item) => {
                      const isSelected = selectedEquipment.find(i => i.type === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedEquipment(selectedEquipment.filter(i => i.type !== item.id));
                            } else {
                              setSelectedEquipment([...selectedEquipment, { type: item.id, quantity: 1 }]);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                            isSelected 
                              ? "bg-yellow-50 border-yellow-400 ring-1 ring-yellow-400" 
                              : "bg-white border-zinc-200 hover:border-zinc-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              isSelected ? "bg-yellow-100 text-yellow-600" : "bg-zinc-100 text-zinc-400"
                            )}>
                              {item.icon}
                            </div>
                            <span className={cn("text-sm font-bold", isSelected ? "text-zinc-900" : "text-zinc-600")}>
                              {item.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEquipment(selectedEquipment.map(i => 
                                    i.type === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i
                                  ));
                                }}
                                className="h-6 w-6 flex items-center justify-center rounded bg-white border border-zinc-200 text-zinc-600"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-4 text-center">{isSelected.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEquipment(selectedEquipment.map(i => 
                                    i.type === item.id ? { ...i, quantity: Math.min(5, i.quantity + 1) } : i
                                  ));
                                }}
                                className="h-6 w-6 flex items-center justify-center rounded bg-white border border-zinc-200 text-zinc-600"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-zinc-100" />
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-2 whitespace-nowrap">Método de Pago</label>
                    <div className="h-px flex-1 bg-zinc-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('efectivo')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all group relative overflow-hidden",
                        paymentMethod === 'efectivo' 
                          ? "border-yellow-400 bg-yellow-50 text-yellow-700 ring-4 ring-yellow-400/10 shadow-lg shadow-yellow-400/5 scale-[1.02]" 
                          : "border-zinc-100 bg-white text-zinc-500 hover:border-zinc-200"
                      )}
                    >
                      <div className={cn(
                        "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110",
                        paymentMethod === 'efectivo' ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/30 rotate-3" : "bg-zinc-100 text-zinc-400"
                      )}>
                        <Banknote className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-tight">Efectivo</span>
                      <p className="text-[8px] font-bold opacity-60 text-center leading-tight uppercase tracking-wider">Pago en Sede</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('transferencia')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all group relative overflow-hidden",
                        paymentMethod === 'transferencia' 
                          ? "border-yellow-400 bg-yellow-50 text-yellow-700 ring-4 ring-yellow-400/10 shadow-lg shadow-yellow-400/5 scale-[1.02]" 
                          : "border-zinc-100 bg-white text-zinc-500 hover:border-zinc-200"
                      )}
                    >
                      <div className={cn(
                        "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110",
                        paymentMethod === 'transferencia' ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/30 -rotate-3" : "bg-zinc-100 text-zinc-400"
                      )}>
                        <Smartphone className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-tight">Transferencia</span>
                      <p className="text-[8px] font-bold opacity-60 text-center leading-tight uppercase tracking-wider">Sube Comprobante</p>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'transferencia' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 space-y-5 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                      <Smartphone className="h-20 w-20 text-white" />
                    </div>

                    <div className="space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                          Datos Bancarios
                        </p>
                        <div className="px-2 py-0.5 bg-yellow-400/10 border border-yellow-400/20 rounded-full">
                          <span className="text-[8px] font-black text-yellow-400 uppercase">Verificado</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 px-1">
                        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Banco</span>
                          <span className="text-xs text-white font-black tracking-tight">Banco Estado</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Tipo</span>
                          <span className="text-xs text-white font-black tracking-tight">Cuenta RUT</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">RUT</span>
                          <span className="text-xs text-white font-black tracking-tight">21.697.781-6</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">N° Cuenta</span>
                          <span className="text-sm text-yellow-400 font-mono font-black tracking-widest leading-none">21697781</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 relative">
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Cargar Comprobante</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 500 * 1024) {
                                toast.error('La imagen es muy pesada (máx 500KB)');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                const base64 = reader.result as string;
                                setReceiptImage(base64);
                                handleBooking(base64);
                              };
                              reader.readAsDataURL(file);
                              // Reset value to allow re-uploading same file
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                          id="receipt-upload"
                        />
                        <label 
                          htmlFor="receipt-upload"
                          className={cn(
                            "flex flex-col items-center justify-center w-full min-h-[5rem] border-2 border-dashed rounded-[1.5rem] cursor-pointer transition-all duration-300",
                            receiptImage 
                              ? "border-green-400/50 bg-green-500/10 shadow-lg shadow-green-500/10" 
                              : "border-zinc-800 bg-zinc-800/30 hover:border-yellow-400/50 hover:bg-zinc-800/50"
                          )}
                        >
                          {receiptImage ? (
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-green-400" />
                              <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Listo para enviar</span>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setReceiptImage(null);
                                }}
                                className="p-2 bg-zinc-950 rounded-full hover:bg-red-500 transition-colors shadow-lg relative z-10"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zinc-400" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Smartphone className="h-6 w-6 text-zinc-600 mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Click para adjuntar capture</span>
                            </>
                          )}
                        </label>
                      </div>
                      {receiptImage && (
                        <div className="mt-2 rounded-2xl overflow-hidden border border-zinc-800 max-h-32 shadow-2xl ring-1 ring-white/5">
                          <img src={receiptImage} alt="Preview" className="w-full object-contain" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {user?.isVip && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="vipBooking"
                      checked={isVipBooking}
                      onChange={e => setIsVipBooking(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-yellow-500 focus:ring-yellow-400"
                    />
                    <label htmlFor="vipBooking" className="text-sm font-medium text-zinc-700">
                      Reserva VIP (Cancha exclusiva + Bebestibles)
                    </label>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <p className="text-xs text-zinc-600">
                    Recuerda llegar 5 minutos antes. La reserva es por 1 hora.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsBookingModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={isUploading}
                    className={cn(
                      "flex-1 px-6 py-3 text-sm font-bold text-black bg-yellow-400 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed",
                      isUploading && "animate-pulse"
                    )}
                  >
                    {isUploading ? 'Procesando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FriendlyMatches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<FriendlyMatch[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMatch, setNewMatch] = useState({
    sport: 'futbol' as 'futbol' | 'padel',
    level: 'principiante' as any,
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    fieldId: 'cancha-1' as FieldId,
    maxParticipants: 10,
    isPrivate: false,
  });

  useEffect(() => {
    if (!user) {
      setMatches([]);
      return;
    }
    const q = query(collection(db, 'friendlyMatches'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: (doc.data().date as Timestamp).toDate().toISOString(),
      })) as FriendlyMatch[];
      setMatches(docs);
    }, (error) => {
      console.error("Error fetching friendly matches:", error);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      return;
    }
    const q = query(collection(db, 'bookings'), where('status', '==', 'confirmed'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: (doc.data().startTime as Timestamp).toDate().toISOString(),
        endTime: (doc.data().endTime as Timestamp).toDate().toISOString(),
      })) as Booking[];
      setBookings(docs);
    }, (error) => {
      console.error("Error fetching bookings for collision check:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const startTime = new Date(newMatch.date);
    const endTime = addHours(startTime, 1);
    const dayOfWeek = getDay(startTime);
    const hour = getHours(startTime);

    // Availability rules
    const isSunday = dayOfWeek === 0;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMorning = hour >= 8 && hour < 12;
    const isFootballField = newMatch.fieldId.includes('cancha');

    if (isSunday) {
      toast.error('La sede está cerrada los domingos');
      return;
    }

    if (isWeekday && isMorning && isFootballField) {
      toast.error('Las canchas de fútbol no están disponibles en las mañanas (8:00 - 12:00)');
      return;
    }

    // Collision check
    const isTaken = bookings.some(b => 
      b.fieldId === newMatch.fieldId && 
      new Date(b.startTime).getTime() === startTime.getTime()
    );

    if (isTaken) {
      toast.error('Este horario ya está reservado o tiene otro partido');
      return;
    }

    try {
      const matchDoc = await addDoc(collection(db, 'friendlyMatches'), {
        ...newMatch,
        date: Timestamp.fromDate(new Date(newMatch.date)),
        organizerId: user.uid,
        participants: [user.displayName],
        status: 'open',
        isPrivate: newMatch.isPrivate,
        isVip: user.isVip,
      });

      // Create a booking for this friendly match
      const startTime = new Date(newMatch.date);
      const endTime = addHours(startTime, 1);
      
      await addDoc(collection(db, 'bookings'), {
        fieldId: newMatch.fieldId,
        userId: user.uid,
        userName: user.displayName,
        participants: [user.displayName],
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        status: 'confirmed',
        bookingType: 'friendly',
        paymentMethod: 'efectivo',
        paymentStatus: 'pendiente',
        isVipBooking: false,
        price: 0, // Bookings for matches are paid separately or free
        createdAt: Timestamp.now(),
        referenceId: matchDoc.id
      });

      toast.success('Partido amistoso creado y cancha reservada');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Error creating match:', error);
      toast.error('Error al crear partido');
    }
  };

  const joinMatch = async (match: FriendlyMatch) => {
    if (!user) return;
    if (match.participants.includes(user.displayName)) {
      toast.error('Ya estás en este partido');
      return;
    }
    if (match.participants.length >= match.maxParticipants) {
      toast.error('Partido lleno');
      return;
    }

    try {
      const matchRef = doc(db, 'friendlyMatches', match.id);
      const newParticipants = [...match.participants, user.displayName];
      await updateDoc(matchRef, {
        participants: newParticipants,
        status: newParticipants.length >= match.maxParticipants ? 'full' : 'open'
      });
      toast.success('Te has unido al partido');
    } catch (error) {
      console.error('Error joining match:', error);
      toast.error('Error al unirse');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Partidos Amistosos</h2>
          <p className="text-sm text-zinc-500">Encuentra jugadores de tu mismo nivel</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Organizar Partido
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {matches.filter(m => !m.isPrivate || m.organizerId === user?.uid).map((m) => (
          <div key={m.id} className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  m.sport === 'futbol' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                )}>
                  {m.sport === 'futbol' ? 'Fútbol' : 'Padel'} • {m.level}
                </div>
                {m.isPrivate && (
                  <span className="px-2 py-1 bg-zinc-100 text-zinc-500 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Privado
                  </span>
                )}
                {m.isVip && <VIPBadge />}
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-zinc-400">
                <Users className="h-4 w-4" />
                {m.participants.length}/{m.maxParticipants}
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Calendar className="h-4 w-4 text-zinc-400" />
                {format(new Date(m.date), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <MapPin className="h-4 w-4 text-zinc-400" />
                {m.fieldId.includes('cancha') ? `Cancha Fútbol ${m.fieldId.split('-')[1]}` : `Cancha Padel ${m.fieldId.split('-')[1]}`}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {m.participants.map((p, i) => (
                <div key={i} className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600">
                  {p}
                </div>
              ))}
            </div>

            <button 
              onClick={() => joinMatch(m)}
              disabled={m.status === 'full' || m.participants.includes(user?.displayName || '')}
              className={cn(
                "w-full py-3 rounded-xl text-sm font-bold transition-all",
                m.participants.includes(user?.displayName || '')
                  ? "bg-zinc-100 text-zinc-400 cursor-default"
                  : m.status === 'full'
                  ? "bg-zinc-50 text-zinc-300 cursor-not-allowed"
                  : "bg-yellow-400 text-black hover:bg-yellow-500 shadow-lg shadow-yellow-400/20"
              )}
            >
              {m.participants.includes(user?.displayName || '') ? 'Ya estás dentro' : m.status === 'full' ? 'Partido Lleno' : 'Unirse al Partido'}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-6">Organizar Partido</h3>
              <form onSubmit={handleCreateMatch} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Deporte</label>
                    <select
                      value={newMatch.sport}
                      onChange={e => setNewMatch({ ...newMatch, sport: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      <option value="futbol">Fútbol</option>
                      <option value="padel">Padel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Nivel</label>
                    <select
                      value={newMatch.level}
                      onChange={e => setNewMatch({ ...newMatch, level: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={newMatch.date}
                    onChange={e => setNewMatch({ ...newMatch, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Cancha</label>
                  <select
                    value={newMatch.fieldId}
                    onChange={e => setNewMatch({ ...newMatch, fieldId: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="cancha-1">Fútbol 1</option>
                    <option value="cancha-2">Fútbol 2</option>
                    <option value="padel-1">Padel 1</option>
                    <option value="padel-2">Padel 2</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={newMatch.isPrivate}
                    onChange={e => setNewMatch({ ...newMatch, isPrivate: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-yellow-500 focus:ring-yellow-400"
                  />
                  <label htmlFor="isPrivate" className="text-sm font-medium text-zinc-700">
                    Partido Privado (Solo invitados)
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 text-sm font-bold text-black bg-yellow-400 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20"
                  >
                    Crear Partido
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EquipmentRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ type: any, quantity: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'equipmentRequests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      })) as EquipmentRequest[];
      setRequests(docs);
    });
    return unsubscribe;
  }, [user]);

  const handleRequest = async () => {
    if (!user || selectedItems.length === 0) return;
    try {
      await addDoc(collection(db, 'equipmentRequests'), {
        userId: user.uid,
        userName: user.displayName,
        items: selectedItems,
        status: 'pending',
        isVip: user.isVip,
        createdAt: Timestamp.now(),
      });
      toast.success('Solicitud de implementos enviada');
      setIsRequestModalOpen(false);
      setSelectedItems([]);
    } catch (error) {
      console.error('Error requesting equipment:', error);
      toast.error('Error al enviar solicitud');
    }
  };

  const toggleItem = (type: any) => {
    const exists = selectedItems.find(i => i.type === type);
    if (exists) {
      setSelectedItems(selectedItems.filter(i => i.type !== type));
    } else {
      setSelectedItems([...selectedItems, { type, quantity: 1 }]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Implementos Deportivos</h2>
          <p className="text-sm text-zinc-500">Pide lo que necesites para tu partido</p>
        </div>
        <button 
          onClick={() => setIsRequestModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Pedir Implementos
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                  req.status === 'pending' ? "bg-yellow-100 text-yellow-600" :
                  req.status === 'approved' ? "bg-green-100 text-green-600" :
                  req.status === 'returned' ? "bg-blue-100 text-blue-600" :
                  "bg-red-100 text-red-600"
                )}>
                  {req.status}
                </span>
                {req.isVip && <VIPBadge />}
              </div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                {format(new Date(req.createdAt), "d MMM, HH:mm")}
              </span>
            </div>
            <div className="space-y-2">
              {req.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 capitalize">{item.type.replace('-', ' ')}</span>
                  <span className="font-bold text-zinc-900">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="col-span-full py-12 text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
            <Package className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">No has pedido implementos aún</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isRequestModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-6">Pedir Implementos</h3>
              <div className="space-y-4 mb-8">
                {[
                  { id: 'pelota-futbol', name: 'Pelota de Fútbol', icon: Dribbble },
                  { id: 'paleta-padel', name: 'Paleta de Padel', icon: Gamepad2 },
                  { id: 'pelota-padel', name: 'Pelotas de Padel (Tubo)', icon: CircleDot },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                      selectedItems.find(i => i.type === item.id)
                        ? "border-yellow-400 bg-yellow-50 ring-2 ring-yellow-400/20"
                        : "border-zinc-100 bg-zinc-50 hover:bg-zinc-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        selectedItems.find(i => i.type === item.id) ? "bg-yellow-400 text-black" : "bg-white text-zinc-400"
                      )}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-zinc-900">{item.name}</span>
                    </div>
                    {selectedItems.find(i => i.type === item.id) && (
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            const newItems = [...selectedItems];
                            const idx = newItems.findIndex(i => i.type === item.id);
                            if (newItems[idx].quantity > 1) newItems[idx].quantity--;
                            setSelectedItems(newItems);
                          }}
                          className="h-6 w-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600"
                        >-</button>
                        <span className="text-sm font-black">{selectedItems.find(i => i.type === item.id)?.quantity}</span>
                        <button 
                          onClick={() => {
                            const newItems = [...selectedItems];
                            const idx = newItems.findIndex(i => i.type === item.id);
                            newItems[idx].quantity++;
                            setSelectedItems(newItems);
                          }}
                          className="h-6 w-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600"
                        >+</button>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRequest}
                  disabled={selectedItems.length === 0}
                  className="flex-1 px-6 py-3 text-sm font-bold text-black bg-yellow-400 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20 disabled:opacity-50 disabled:shadow-none"
                >
                  Enviar Pedido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedbackSection() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    type: 'review' as 'review' | 'complaint',
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    if (!user) {
      setFeedbacks([]);
      return;
    }
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      })) as Feedback[];
      setFeedbacks(docs);
    }, (error) => {
      console.error("Error fetching feedback:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFeedback.comment.trim()) return;

    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: user.displayName,
        type: newFeedback.type,
        rating: newFeedback.type === 'review' ? newFeedback.rating : null,
        comment: newFeedback.comment,
        status: 'pending',
        isVip: user.isVip,
        createdAt: Timestamp.now(),
      });
      toast.success(newFeedback.type === 'review' ? '¡Gracias por tu reseña!' : 'Tu queja ha sido registrada');
      setIsModalOpen(false);
      setNewFeedback({ type: 'review', rating: 5, comment: '' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Error al enviar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Reseñas y Quejas</h2>
          <p className="text-sm text-zinc-500">Ayúdanos a mejorar tu experiencia en la sede</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Reseña/Queja
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {feedbacks.map((f) => (
          <div key={f.id} className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  f.type === 'review' ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                )}>
                  {f.type === 'review' ? <Star className="h-4 w-4 fill-current" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  {f.type === 'review' ? 'Reseña' : 'Queja'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">
                {format(new Date(f.createdAt), "d MMM")}
              </span>
            </div>

            {f.type === 'review' && (
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "h-3 w-3",
                      i < (f.rating || 0) ? "text-yellow-400 fill-current" : "text-zinc-200"
                    )} 
                  />
                ))}
              </div>
            )}

            <p className="text-sm text-zinc-600 italic mb-4 flex-grow">"{f.comment}"</p>
            
            <div className="flex items-center gap-2 pt-4 border-t border-zinc-100">
              <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                {f.userName.charAt(0)}
              </div>
              <span className="text-xs font-bold text-zinc-900">{f.userName}</span>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-6">Enviar Comentario</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex p-1 bg-zinc-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewFeedback({ ...newFeedback, type: 'review' })}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      newFeedback.type === 'review' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                    )}
                  >Reseña</button>
                  <button
                    type="button"
                    onClick={() => setNewFeedback({ ...newFeedback, type: 'complaint' })}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      newFeedback.type === 'complaint' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                    )}
                  >Queja</button>
                </div>

                {newFeedback.type === 'review' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Calificación</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewFeedback({ ...newFeedback, rating: star })}
                          className="p-1"
                        >
                          <Star className={cn(
                            "h-8 w-8 transition-all",
                            star <= newFeedback.rating ? "text-yellow-400 fill-current scale-110" : "text-zinc-200"
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Comentario</label>
                  <textarea
                    value={newFeedback.comment}
                    onChange={e => setNewFeedback({ ...newFeedback, comment: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 outline-none focus:ring-2 focus:ring-yellow-400 min-h-[120px] text-sm"
                    placeholder={newFeedback.type === 'review' ? "¿Qué te pareció el servicio?" : "Cuéntanos qué sucedió..."}
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                  >Cancelar</button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 text-sm font-bold text-black bg-yellow-400 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20"
                  >Enviar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminPanel() {
  const { user } = useAuth();
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setAllBookings([]);
      return;
    }
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: (doc.data().startTime as Timestamp).toDate().toISOString(),
        endTime: (doc.data().endTime as Timestamp).toDate().toISOString(),
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      })) as Booking[];
      setAllBookings(docs);
    }, (error) => {
      console.error("Admin: Error fetching all bookings:", error);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setEquipmentRequests([]);
      return;
    }
    const q = query(collection(db, 'equipmentRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      })) as EquipmentRequest[];
      setEquipmentRequests(docs);
    }, (error) => {
      console.error("Admin: Error fetching equipment requests:", error);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setFeedbacks([]);
      return;
    }
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString(),
      })) as Feedback[];
      setFeedbacks(docs);
      setLoading(false);
    }, (error) => {
      console.error("Admin: Error fetching feedback:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const updateFeedbackStatus = async (id: string, status: any) => {
    try {
      await updateDoc(doc(db, 'feedback', id), { status });
      toast.success('Estado actualizado');
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error('Error al actualizar');
    }
  };

  const updateEquipmentStatus = async (requestId: string, status: any) => {
    try {
      await updateDoc(doc(db, 'equipmentRequests', requestId), { status });
      toast.success('Estado de implementos actualizado');
    } catch (error) {
      console.error('Error updating equipment:', error);
      toast.error('Error al actualizar');
    }
  };

  const updatePaymentStatus = async (bookingId: string, status: 'pendiente' | 'completado' | 'esperando_validacion') => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { paymentStatus: status });
      toast.success('Estado de pago actualizado');
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Error al actualizar pago');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status: 'cancelled' });
      toast.success('Reserva cancelada');
      setBookingToCancel(null);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Error al cancelar');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Panel de Administración</h2>
          <p className="text-sm text-zinc-500">Gestiona todas las reservas y valida pagos</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">Reservas de Canchas</h3>
        </div>
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Fecha/Hora</th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Cancha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Pago</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {allBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-900">{format(new Date(b.startTime), "d MMM, HH:mm")}</p>
                      <p className="text-[10px] text-zinc-400">{format(new Date(b.createdAt), "HH:mm:ss")}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {b.isVipBooking && <VIPBadge />}
                        <span className="font-medium text-zinc-700">{b.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-600 uppercase">
                        {b.fieldId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        b.bookingType === 'friendly' ? "bg-blue-100 text-blue-600" :
                        b.bookingType === 'tournament' ? "bg-yellow-100 text-yellow-600" :
                        "bg-zinc-100 text-zinc-600"
                      )}>
                        {b.bookingType || 'Regular'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">{b.paymentMethod}</span>
                          {b.receiptUrl && (
                            <button
                              onClick={() => {
                                // Create a temporary overlay to see the receipt
                                const overlay = document.createElement('div');
                                overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4';
                                overlay.onclick = () => document.body.removeChild(overlay);
                                
                                const img = document.createElement('img');
                                img.src = b.receiptUrl!;
                                img.className = 'max-w-full max-h-full rounded-xl shadow-2xl';
                                
                                overlay.appendChild(img);
                                document.body.appendChild(overlay);
                              }}
                              className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[8px] font-black uppercase hover:bg-yellow-200 transition-colors"
                            >
                              Ver Comprobante
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => updatePaymentStatus(b.id, 'completado')}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase transition-all",
                              b.paymentStatus === 'completado' ? "bg-green-100 text-green-600 ring-1 ring-green-600" : "bg-zinc-100 text-zinc-400 hover:bg-green-50 hover:text-green-600"
                            )}
                          >
                            Pagado
                          </button>
                          <button
                            onClick={() => updatePaymentStatus(b.id, 'pendiente')}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase transition-all",
                              b.paymentStatus === 'pendiente' ? "bg-red-100 text-red-600 ring-1 ring-red-600" : "bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            )}
                          >
                            Pendiente
                          </button>
                          {b.paymentStatus === 'esperando_validacion' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-yellow-100 text-yellow-600 ring-1 ring-yellow-600">
                              Validando
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        b.status === 'confirmed' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}>
                        {b.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => setBookingToCancel(b.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Cancelar Reserva"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-8">
          <h3 className="text-lg font-bold text-zinc-900">Solicitudes de Implementos</h3>
        </div>
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Implementos</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {equipmentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {req.isVip && <VIPBadge />}
                        <span className="font-medium text-zinc-700">{req.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {req.items.map((item, i) => (
                          <span key={i} className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-bold text-zinc-600">
                            {item.quantity}x {item.type.replace('-', ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        req.status === 'pending' ? "bg-yellow-100 text-yellow-600" :
                        req.status === 'approved' ? "bg-green-100 text-green-600" :
                        req.status === 'returned' ? "bg-blue-100 text-blue-600" :
                        "bg-red-100 text-red-600"
                      )}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateEquipmentStatus(req.id, 'approved')}
                              className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"
                            >Aprobar</button>
                            <button
                              onClick={() => updateEquipmentStatus(req.id, 'rejected')}
                              className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600"
                            >Rechazar</button>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <button
                            onClick={() => updateEquipmentStatus(req.id, 'returned')}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600"
                          >Devuelto</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-8">
          <h3 className="text-lg font-bold text-zinc-900">Reseñas y Quejas</h3>
        </div>
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Comentario</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {feedbacks.map((f) => (
                  <tr key={f.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {f.isVip && <VIPBadge />}
                        <span className="font-medium text-zinc-700">{f.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        f.type === 'review' ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"
                      )}>
                        {f.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-zinc-500">{f.comment}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        f.status === 'pending' ? "bg-zinc-100 text-zinc-400" :
                        f.status === 'resolved' ? "bg-green-100 text-green-600" :
                        "bg-zinc-200 text-zinc-500"
                      )}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {f.status === 'pending' && (
                          <button
                            onClick={() => updateFeedbackStatus(f.id, 'resolved')}
                            className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600"
                          >Resolver</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {bookingToCancel && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">¿Cancelar Reserva?</h3>
              <p className="text-zinc-500 mb-8">Esta acción marcará la reserva como cancelada y liberará el horario.</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setBookingToCancel(null)}
                  className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={() => cancelBooking(bookingToCancel)}
                  className="flex-1 px-6 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    description: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  });
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTournaments([]);
      return;
    }
    const q = query(collection(db, 'tournaments'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: (doc.data().startDate as Timestamp).toDate().toISOString(),
        endDate: (doc.data().endDate as Timestamp).toDate().toISOString(),
      })) as Tournament[];
      setTournaments(docs);
    }, (error) => {
      console.error("Error fetching tournaments:", error);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      return;
    }
    const q = query(collection(db, 'bookings'), where('status', '==', 'confirmed'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: (doc.data().startTime as Timestamp).toDate().toISOString(),
        endTime: (doc.data().endTime as Timestamp).toDate().toISOString(),
      })) as Booking[];
      setBookings(docs);
    }, (error) => {
      console.error("Error fetching bookings for tournament check:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'admin') return;

    try {
      await addDoc(collection(db, 'tournaments'), {
        ...newTournament,
        createdBy: user.uid,
        startDate: Timestamp.fromDate(new Date(newTournament.startDate)),
        endDate: Timestamp.fromDate(new Date(newTournament.endDate)),
        status: 'upcoming',
        teams: [],
        matches: [],
      });
      toast.success('Campeonato creado con éxito');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast.error('Error al crear el campeonato');
    }
  };

  const updateMatchScore = async (tournamentId: string, matchId: string, scoreA: number, scoreB: number) => {
    if (!user || user.role !== 'admin') return;
    
    try {
      const tournament = tournaments.find(t => t.id === tournamentId);
      if (!tournament) return;

      const updatedMatches = tournament.matches.map(m => 
        m.id === matchId ? { ...m, scoreA, scoreB, status: 'completed' as const } : m
      );

      await updateDoc(doc(db, 'tournaments', tournamentId), {
        matches: updatedMatches
      });
      
      toast.success('Resultado actualizado');
    } catch (error) {
      console.error('Error updating score:', error);
      toast.error('Error al actualizar resultado');
    }
  };

  const addMatch = async (tournamentId: string, teamAId: string, teamBId: string, date: string, fieldId: FieldId) => {
    if (!user || user.role !== 'admin') return;

    const startTime = new Date(date);
    const endTime = addHours(startTime, 1);
    const dayOfWeek = getDay(startTime);
    const hour = getHours(startTime);

    // Availability rules
    const isSunday = dayOfWeek === 0;
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMorning = hour >= 8 && hour < 12;
    const isFootballField = fieldId.includes('cancha');

    if (isSunday) {
      toast.error('La sede está cerrada los domingos');
      return;
    }

    if (isWeekday && isMorning && isFootballField) {
      toast.error('Las canchas de fútbol no están disponibles en las mañanas (8:00 - 12:00)');
      return;
    }

    // Collision check
    const isTaken = bookings.some(b => 
      b.fieldId === fieldId && 
      new Date(b.startTime).getTime() === startTime.getTime()
    );

    if (isTaken) {
      toast.error('Este horario ya está reservado o tiene otro partido');
      return;
    }

    try {
      const tournament = tournaments.find(t => t.id === tournamentId);
      if (!tournament) return;

      const newMatch: Match = {
        id: Math.random().toString(36).substr(2, 9),
        teamAId,
        teamBId,
        date,
        fieldId,
        status: 'pending'
      };

      await updateDoc(doc(db, 'tournaments', tournamentId), {
        matches: [...(tournament.matches || []), newMatch]
      });

      // Create a booking for this tournament match
      await addDoc(collection(db, 'bookings'), {
        fieldId,
        userId: user.uid,
        userName: `Torneo: ${tournament.name}`,
        participants: [],
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        status: 'confirmed',
        bookingType: 'tournament',
        paymentMethod: 'efectivo',
        paymentStatus: 'completado',
        isVipBooking: false,
        price: 0, // Tournament bookings are handled by admin
        createdAt: Timestamp.now(),
        referenceId: tournamentId
      });
      
      toast.success('Partido programado y cancha reservada');
    } catch (error) {
      console.error('Error adding match:', error);
      toast.error('Error al programar partido');
    }
  };

  const deleteTournament = async (tournamentId: string) => {
    if (!user || user.role !== 'admin') return;

    try {
      await deleteDoc(doc(db, 'tournaments', tournamentId));
      toast.success('Campeonato eliminado');
      setTournamentToDelete(null);
      if (selectedTournament?.id === tournamentId) {
        setIsDetailsModalOpen(false);
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Error al eliminar el campeonato');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Campeonatos</h2>
          <p className="text-sm text-zinc-500">Participa en los torneos de la sede</p>
        </div>
        {user?.role === 'admin' && (
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Crear Torneo
          </button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {tournaments.map((t) => (
          <div key={t.id} className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                t.status === 'upcoming' ? "bg-blue-100 text-blue-600" :
                t.status === 'ongoing' ? "bg-green-100 text-green-600" :
                "bg-zinc-100 text-zinc-600"
              )}>
                {t.status === 'upcoming' ? 'Próximamente' : t.status === 'ongoing' ? 'En curso' : 'Finalizado'}
              </div>
              <div className="flex items-center gap-2">
                {user?.role === 'admin' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTournamentToDelete(t.id);
                    }}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Eliminar Torneo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">{t.name}</h3>
            <p className="text-sm text-zinc-500 mb-6 line-clamp-2">{t.description}</p>
            
            <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(t.startDate), 'd MMM')}
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {t.teams?.length || 0} Equipos
              </div>
            </div>

            <button 
              onClick={() => {
                setSelectedTournament(t);
                setIsDetailsModalOpen(true);
              }}
              className="mt-6 w-full py-3 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-900 hover:bg-zinc-50 transition-colors"
            >
              Ver Detalles y Resultados
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {tournamentToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">¿Eliminar Campeonato?</h3>
              <p className="text-zinc-500 mb-8">Esta acción es permanente y eliminará todos los partidos asociados.</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setTournamentToDelete(null)}
                  className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteTournament(tournamentToDelete)}
                  className="flex-1 px-6 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailsModalOpen && selectedTournament && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-zinc-900">{selectedTournament.name}</h3>
                <button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <Plus className="h-6 w-6 rotate-45 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">Partidos y Resultados</h4>
                  <div className="space-y-4">
                    {selectedTournament.matches?.length === 0 ? (
                      <p className="text-sm text-zinc-500 italic">No hay partidos programados aún.</p>
                    ) : (
                      selectedTournament.matches?.map((match) => {
                        const teamA = selectedTournament.teams.find(t => t.id === match.teamAId);
                        const teamB = selectedTournament.teams.find(t => t.id === match.teamBId);
                        return (
                          <div key={match.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">{format(new Date(match.date), "d MMM, HH:mm")}</span>
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                match.status === 'completed' ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                              )}>
                                {match.status === 'completed' ? 'Finalizado' : 'Pendiente'}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 text-right font-bold text-zinc-900">{teamA?.name || 'Equipo A'}</div>
                              
                              <div className="flex items-center gap-2">
                                {user?.role === 'admin' ? (
                                  <>
                                    <input 
                                      type="number" 
                                      defaultValue={match.scoreA || 0}
                                      className="w-12 h-10 text-center bg-white border border-zinc-200 rounded-lg font-bold"
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) updateMatchScore(selectedTournament.id, match.id, val, match.scoreB || 0);
                                      }}
                                    />
                                    <span className="text-zinc-300">-</span>
                                    <input 
                                      type="number" 
                                      defaultValue={match.scoreB || 0}
                                      className="w-12 h-10 text-center bg-white border border-zinc-200 rounded-lg font-bold"
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val)) updateMatchScore(selectedTournament.id, match.id, match.scoreA || 0, val);
                                      }}
                                    />
                                  </>
                                ) : (
                                  <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-zinc-100 font-black text-xl">
                                    <span>{match.scoreA ?? '-'}</span>
                                    <span className="text-zinc-200">:</span>
                                    <span>{match.scoreB ?? '-'}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 text-left font-bold text-zinc-900">{teamB?.name || 'Equipo B'}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {user?.role === 'admin' && (
                  <section className="pt-6 border-t border-zinc-100">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">Programar Nuevo Partido</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <select id="teamA" className="px-4 py-2 rounded-xl border border-zinc-200 text-sm">
                        <option value="">Seleccionar Equipo A</option>
                        {selectedTournament.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select id="teamB" className="px-4 py-2 rounded-xl border border-zinc-200 text-sm">
                        <option value="">Seleccionar Equipo B</option>
                        {selectedTournament.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input type="datetime-local" id="matchDate" className="px-4 py-2 rounded-xl border border-zinc-200 text-sm" />
                      <button 
                        onClick={() => {
                          const teamA = (document.getElementById('teamA') as HTMLSelectElement).value;
                          const teamB = (document.getElementById('teamB') as HTMLSelectElement).value;
                          const date = (document.getElementById('matchDate') as HTMLInputElement).value;
                          if (teamA && teamB && date) addMatch(selectedTournament.id, teamA, teamB, date, 'cancha-1');
                          else toast.error('Completa todos los campos');
                        }}
                        className="bg-black text-white px-4 py-2 rounded-xl text-sm font-bold"
                      >
                        Programar
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-6">Nuevo Campeonato</h3>
              <form onSubmit={handleCreateTournament} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Nombre del Torneo</label>
                  <input
                    required
                    type="text"
                    value={newTournament.name}
                    onChange={e => setNewTournament({ ...newTournament, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    placeholder="Ej: Copa Duoc Maipú 2024"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Descripción</label>
                  <textarea
                    required
                    value={newTournament.description}
                    onChange={e => setNewTournament({ ...newTournament, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all h-24 resize-none"
                    placeholder="Detalles del torneo, premios, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Fecha Inicio</label>
                    <input
                      required
                      type="date"
                      value={newTournament.startDate}
                      onChange={e => setNewTournament({ ...newTournament, startDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Fecha Fin</label>
                    <input
                      required
                      type="date"
                      value={newTournament.endDate}
                      onChange={e => setNewTournament({ ...newTournament, endDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 text-sm font-bold text-black bg-yellow-400 rounded-xl hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-400/20"
                  >
                    Crear Torneo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VipUpgrade() {
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setIsUpgrading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { isVip: true });
      toast.success('¡Felicidades! Ahora eres miembro VIP');
    } catch (error) {
      console.error('Error upgrading to VIP:', error);
      toast.error('Error al procesar el upgrade');
    } finally {
      setIsUpgrading(false);
    }
  };

  if (user?.isVip) return null;

  return (
    <div className="mt-8 bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-yellow-400/20 transition-all duration-700" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-400 text-black rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
            <Star className="h-3 w-3 fill-black" />
            Oferta Especial
          </div>
          <h3 className="text-3xl font-black mb-4 leading-tight">Únete al Club VIP y obtén beneficios exclusivos</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {[
              '20% de descuento en todas las reservas',
              'Prioridad en Cancha 1 (Juega con público)',
              'Bebestibles gratis post-partido',
              'Prioridad en solicitud de implementos',
              'Invitaciones privadas ilimitadas',
              'Soporte prioritario 24/7'
            ].map((benefit, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                <CheckCircle2 className="h-4 w-4 text-yellow-400" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-4 min-w-[200px]">
          <div className="text-center">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1 line-through">$10.000 / mes</p>
            <p className="text-4xl font-black text-white">$4.990<span className="text-sm font-medium text-zinc-500"> / mes</span></p>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="w-full px-8 py-4 bg-yellow-400 text-black rounded-2xl font-black uppercase tracking-wider hover:bg-yellow-500 transition-all active:scale-95 shadow-xl shadow-yellow-400/20 disabled:opacity-50"
          >
            {isUpgrading ? 'Procesando...' : 'Mejorar a VIP'}
          </button>
          <p className="text-[10px] text-zinc-500 font-medium">Cancela en cualquier momento</p>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookings' | 'tournaments' | 'friendly' | 'admin' | 'equipment' | 'feedback'>('bookings');

  const updateExperience = async (sport: 'futbol' | 'padel', level: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        experience: {
          [sport]: level
        }
      }, { merge: true });
      toast.success(`Nivel de ${sport} actualizado`);
    } catch (error) {
      console.error('Error updating experience:', error);
      toast.error('Error al actualizar nivel');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
              ¡Hola, {user?.displayName.split(' ')[0]}! 👋
            </h1>
            <p className="mt-1 text-zinc-500">Gestiona tus reservas y torneos en la sede Maipú.</p>
            
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Mi Experiencia</p>
                <div className="flex gap-4">
                  <div>
                    <span className="text-xs font-bold text-zinc-600 mr-2">Fútbol:</span>
                    <select 
                      value={user?.experience?.futbol || 'principiante'} 
                      onChange={(e) => updateExperience('futbol', e.target.value)}
                      className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg outline-none"
                    >
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-600 mr-2">Padel:</span>
                    <select 
                      value={user?.experience?.padel || 'principiante'} 
                      onChange={(e) => updateExperience('padel', e.target.value)}
                      className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg outline-none"
                    >
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                </div>
              </div>

              {user?.isVip && (
                <div className="bg-yellow-400 p-3 rounded-2xl shadow-lg shadow-yellow-400/20 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-black" />
                  <span className="text-xs font-black text-black uppercase tracking-wider">Miembro VIP</span>
                </div>
              )}
            </div>

            <VipUpgrade />

            {user?.isVip && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-yellow-200 shadow-sm">
                  <div className="h-8 w-8 bg-yellow-50 rounded-lg flex items-center justify-center mb-2">
                    <Trophy className="h-4 w-4 text-yellow-600" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Canchas</p>
                  <p className="text-xs font-bold text-zinc-900">Prioridad Reserva</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-yellow-200 shadow-sm">
                  <div className="h-8 w-8 bg-yellow-50 rounded-lg flex items-center justify-center mb-2">
                    <Users className="h-4 w-4 text-yellow-600" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Invitaciones</p>
                  <p className="text-xs font-bold text-zinc-900">Privadas Ilimitadas</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-yellow-200 shadow-sm">
                  <div className="h-8 w-8 bg-yellow-50 rounded-lg flex items-center justify-center mb-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Post-Partido</p>
                  <p className="text-xs font-bold text-zinc-900">Bebestibles Incluidos</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-yellow-200 shadow-sm">
                  <div className="h-8 w-8 bg-yellow-50 rounded-lg flex items-center justify-center mb-2">
                    <ShieldCheck className="h-4 w-4 text-yellow-600" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Soporte</p>
                  <p className="text-xs font-bold text-zinc-900">Atención Prioritaria</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex p-1 bg-zinc-200/50 rounded-2xl w-fit overflow-x-auto">
            <button
              onClick={() => setActiveTab('bookings')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'bookings' 
                  ? "bg-white text-zinc-900 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <Calendar className="h-4 w-4" />
              Reservas
            </button>
            <button
              onClick={() => setActiveTab('friendly')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'friendly' 
                  ? "bg-white text-zinc-900 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <Users className="h-4 w-4" />
              Amistosos
            </button>
            <button
              onClick={() => setActiveTab('tournaments')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'tournaments' 
                  ? "bg-white text-zinc-900 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <Trophy className="h-4 w-4" />
              Campeonatos
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeTab === 'feedback' 
                  ? "bg-white text-zinc-900 shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Feedback
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  activeTab === 'admin' 
                    ? "bg-white text-zinc-900 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </button>
            )}
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'bookings' ? (
            <FieldBooking />
          ) : activeTab === 'tournaments' ? (
            <Tournaments />
          ) : activeTab === 'friendly' ? (
            <FriendlyMatches />
          ) : activeTab === 'equipment' ? (
            <EquipmentRequests />
          ) : activeTab === 'feedback' ? (
            <FeedbackSection />
          ) : (
            user?.role === 'admin' && <AdminPanel />
          )}
        </motion.div>
      </main>
    </div>
  );
}

function Login() {
  const { signIn, signInEmail, resetPassword, authError, setAuthError, setIsQrOpen } = useAuth();
  const [useEmail, setUseEmail] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    return () => {
      setAuthError(null);
    };
  }, [setAuthError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const isDuoc = trimmedEmail.endsWith('@duocuc.cl');
      if (!isDuoc) {
        toast.error('Ingresa con tu correo institucional');
        setAuthError('Ingresa con tu correo institucional');
        return;
      }

      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Cuenta creada con éxito');
      } else {
        await signInEmail(email, password);
      }
    } catch (error: any) {
      // Error handled in AuthProvider toast
    }
  };

  const handleReset = async () => {
    if (!email) {
      toast.error('Ingresa tu correo primero');
      return;
    }
    await resetPassword(email);
    setIsResetting(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-950">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-400 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center space-y-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-yellow-400 text-black shadow-2xl shadow-yellow-400/20"
          >
            <Trophy className="h-10 w-10" />
          </motion.div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Duoc UC Maipú
            </h1>
            <p className="text-lg text-zinc-400 font-medium">
              Reserva de Canchas & Torneos
            </p>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl"
          >
            {authError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-left animate-pulse">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-bold leading-tight">{authError}</p>
              </div>
            )}

            {!useEmail ? (
              <>
                <p className="text-zinc-300 mb-8 text-sm leading-relaxed">
                  Accede con tu correo para gestionar tus reservas de fútbol y participar en los campeonatos.
                </p>
                
                <div className="space-y-4">
                  <button
                    onClick={signIn}
                    className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all active:scale-95 shadow-xl"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    Iniciar con Google
                    <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </button>

                  <button
                    onClick={() => setUseEmail(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-800 text-white rounded-2xl font-bold text-lg hover:bg-zinc-700 transition-all active:scale-95"
                  >
                    Iniciar con Email
                  </button>

                  <button
                    onClick={() => setIsQrOpen(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-900 border border-zinc-800 text-yellow-400 rounded-2xl font-bold text-lg hover:bg-zinc-850 transition-all active:scale-95 shadow-lg"
                  >
                    <QrCode className="h-5 w-5 text-yellow-400" />
                    Código QR para Móvil
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-5 py-4 bg-white/10 border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                  />
                </div>
                {!isResetting && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 bg-white/10 border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                    />
                  </div>
                )}
                
                <div className="flex flex-col gap-3 pt-2">
                  {!isResetting ? (
                    <>
                      <button
                        type="submit"
                        className="w-full px-6 py-4 bg-yellow-400 text-black rounded-2xl font-bold text-lg hover:bg-yellow-500 transition-all active:scale-95 shadow-xl shadow-yellow-400/20"
                      >
                        {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                      </button>
                      {!isRegistering && (
                        <button
                          type="button"
                          onClick={() => setIsResetting(true)}
                          className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center hover:text-white transition-colors"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center hover:text-zinc-300 transition-colors"
                      >
                        {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="w-full px-6 py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all active:scale-95 shadow-xl"
                      >
                        Enviar Recuperación
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsResetting(false)}
                        className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center hover:text-white transition-colors"
                      >
                        Volver al inicio
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setUseEmail(false)}
                    className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors pt-4"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Otros métodos
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 flex items-center justify-center gap-6 grayscale opacity-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Acceso Seguro</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-zinc-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sede Maipú</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function QRCodeModal() {
  const { isQrOpen, setIsQrOpen } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!isQrOpen) return null;

  const appUrl = window.location.origin;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}&color=0-0-0&bgcolor=255-255-255&qzone=2`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      toast.success('¡Enlace de la aplicación copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('No se pudo copiar el enlace.');
    }
  };

  const handleDownloadQR = () => {
    const toastId = toast.loading('Generando descarga del QR...');
    fetch(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appUrl)}`)
      .then(response => {
        toast.dismiss(toastId);
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'QR_Duocuc_Deportes.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('¡Código QR descargado!');
      })
      .catch(() => {
        toast.dismiss(toastId);
        window.open(qrCodeUrl, '_blank');
      });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsQrOpen(false)}
          className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        />

        {/* Modal content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-sm bg-zinc-900 text-white rounded-3xl p-6 shadow-2xl text-center border border-zinc-800 overflow-hidden"
        >
          {/* Header design decoration */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500" />
          
          <button
            onClick={() => setIsQrOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mt-4 flex flex-col items-center">
            <div className="p-3 bg-yellow-400/10 text-yellow-400 rounded-2xl mb-4">
              <QrCode className="h-7 w-7" />
            </div>
            
            <h2 className="text-xl font-black text-white tracking-tight">Acceso Rápido QR</h2>
            <p className="mt-2 text-xs text-zinc-400 max-w-xs leading-relaxed">
              Escanea este código con la cámara de tu teléfono móvil para abrir la aplicación directamente.
            </p>
          </div>

          {/* QR Code Graphic Frame */}
          <div className="my-6 mx-auto w-48 h-48 bg-white rounded-2xl p-3 flex items-center justify-center shadow-2xl">
            <img 
              src={qrCodeUrl} 
              alt="Código QR de la aplicación" 
              className="w-full h-full rounded-lg select-none"
            />
          </div>

          {/* Details / Sharing area */}
          <div className="space-y-3">
            <div className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-zinc-400 truncate text-left flex-1 pl-1 select-all">
                {appUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg text-xs font-black transition-all active:scale-95 shadow-sm"
              >
                {copied ? (
                  <>¡Listo!</>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copiar
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={handleDownloadQR}
                className="flex-1 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-black text-xs rounded-xl transition-colors shadow-lg shadow-yellow-400/15"
              >
                Descargar QR
              </button>
              <button
                onClick={() => setIsQrOpen(false)}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {user ? <Dashboard /> : <Login />}
      <QRCodeModal />
    </>
  );
}

