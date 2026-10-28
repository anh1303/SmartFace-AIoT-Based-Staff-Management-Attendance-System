import React from 'react';
import {LogIn,LogOut,HelpCircle} from 'lucide-react';
export function attendanceEventLabel(type:string){return type==='CHECK_IN'?'Vào ca':type==='CHECK_OUT'||type==='TAN_CA'?'Ra ca':'Chưa xác định';}
export function AttendanceEventBadge({type}:{type:string}){const incoming=type==='CHECK_IN',outgoing=type==='CHECK_OUT'||type==='TAN_CA';const Icon=incoming?LogIn:outgoing?LogOut:HelpCircle;return <span className={`sf-badge ${incoming?'blue':outgoing?'success':''}`}><Icon size={14}/>{attendanceEventLabel(type)}</span>;}
