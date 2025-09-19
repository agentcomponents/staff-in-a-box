# Netlify Deployment Guide

## Quick Setup

1. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `public` folder to deploy
   - Or connect your GitHub repo for automatic deployments

2. **Configure your site:**
   - After deployment, update `public/index.html` line 415
   - Replace `your-netlify-site.netlify.app` with your actual Netlify URL

3. **Backend Integration:**
   For full functionality, you'll need to deploy the backend API:
   - Consider using Railway, Render, or Heroku for the Node.js server
   - Update the API URL in the frontend accordingly

## Files for Netlify:
- `public/index.html` - Your complete website
- `public/_redirects` - Handles SPA routing
- `netlify.toml` - Build configuration

## Current Features:
✅ Professional website design
✅ Integrated chat widget
✅ Responsive mobile layout
✅ Real-time messaging interface

## Next Steps:
1. Deploy this frontend to Netlify
2. Test the chat interface (will show connection errors until backend is deployed)
3. Deploy backend to a cloud service
4. Update API URLs for production