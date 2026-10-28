import React,{lazy} from 'react';
import {Navigate,type RouteObject} from 'react-router-dom';
import {AuthGuard} from './guards/AuthGuard';
import {AppLayout} from '../components/layout/AppLayout';
const AccountProfilePage=lazy(()=>import('../pages/account/AccountProfilePage').then(m=>({default:m.AccountProfilePage})));
export const accountRoutes:RouteObject={path:'/app/account',element:<AuthGuard allowedRoles={['admin','manager','employee']}><AppLayout/></AuthGuard>,children:[{index:true,element:<Navigate to="/app/account/profile" replace/>},{path:'profile',element:<AccountProfilePage/>}]};
