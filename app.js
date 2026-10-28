/*
 * AL BAHAR ITINERARY STUDIO — V1.3 QUICK CREATE + OPTIONAL GOOGLE HOTEL SEARCH
 * Static, no-build, GitHub Pages compatible application.
 * Data stays in the browser (localStorage) unless the user exports JSON.
 * Printing uses the browser's native Print / Save as PDF workflow.
 */
(() => {
  'use strict';
  const STORAGE = 'albahar-itinerary-studio-v1'; // Preserve existing browser drafts after upgrade
  const ASSETS = {
    logo: 'assets/al-bahar-logo.png',
    cover: 'assets/destinations/dubai/signature.webp'
  };
  // Destination cover images remain bundled: Google is optional and only searches hotel names/addresses.
  // Add a destination here and put its WebP images under assets/destinations/<slug>/.
  const DESTINATIONS = [
    {id:'kashmir',name:'Kashmir',aliases:['kashmir','srinagar','dal lake','gulmarg','pahalgam','sonamarg'],images:[
      ['signature.webp','Dal Lake · Signature'],['close-up.webp','Valley · Close-up'],['panorama.webp','Himalayan · Panorama']]},
    {id:'kerala',name:'Kerala',aliases:['kerala','alleppey','alappuzha','munnar','kochi','cochin','kumarakom','thekkady'],images:[
      ['signature.webp','Backwaters · Signature'],['close-up.webp','Palm-lined · Close-up'],['panorama.webp','Waterside · Panorama']]},
    {id:'dubai',name:'Dubai',aliases:['dubai','downtown dubai'],images:[
      ['signature.webp','Skyline · Signature'],['close-up.webp','City lights · Close-up'],['panorama.webp','Downtown · Panorama']]},
    {id:'bali',name:'Bali',aliases:['bali','ubud','uluwatu','seminyak','nusa dua'],images:[
      ['signature.webp','Coastline · Signature'],['close-up.webp','Clifftop · Close-up'],['panorama.webp','Ocean · Panorama']]}
  ];
  const norm = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
  function catalogDestination(t){
    const name=norm(t.destination);
    if(!name)return null;
    return DESTINATIONS.find(d=>d.aliases.some(a=>name===a||name.startsWith(a+' ')||name.endsWith(' '+a)||name.includes(' '+a+' ')))||null;
  }
  const catalogImages = d => d ? d.images.map(([file,label])=>({src:`assets/destinations/${d.id}/${file}`,label})) : [];
  function coverFor(t){
    const d=catalogDestination(t), images=catalogImages(d), img=safeImage(t.coverImage);
    if(img && (img.startsWith('data:') || !img.startsWith('assets/destinations/')))return img;
    return images.some(x=>x.src===img)?img:(images[0]?.src||'');
  }
  // Google Maps JavaScript API keys are browser-visible by design. Always restrict
  // this key to your published site (HTTP referrers) and to Maps JavaScript API
  // plus Places API (New) in Google Cloud Console.
  const GOOGLE_KEY_STORAGE = 'albahar-google-places-browser-key';
  const googleKey = () => (localStorage.getItem(GOOGLE_KEY_STORAGE)||'').trim();
  let googleScriptPromise = null;
  function loadGoogleMaps(key) {
    if(window.google?.maps?.importLibrary)return Promise.resolve();
    if(googleScriptPromise)return googleScriptPromise;
    googleScriptPromise = new Promise((resolve,reject) => {
      const callback = '__alBaharGoogleMapsLoaded';
      let finished = false;
      const settle = (err) => { if(finished)return; finished = true; clearTimeout(timeout); delete window[callback]; err ? reject(err) : resolve(); };
      const timeout = setTimeout(() => settle(new Error('Google Maps took too long to load. Check your network and API setup.')), 18000);
      window[callback] = () => settle();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places&callback=${callback}`;
      script.async = true;
      script.onerror = () => settle(new Error('Google Maps failed to load. Check your allowed website and enabled APIs.'));
      document.head.appendChild(script);
    }).catch(e=>{googleScriptPromise=null;throw e;});
    return googleScriptPromise;
  }
  async function mountHotelSearch(){
    const mount=document.getElementById('googleHotelSearchMount');
    if(!mount || mount.dataset.loading)return;
    mount.dataset.loading='1';
    const status=document.getElementById('googleHotelSearchStatus');
    if(status)status.textContent='Connecting to Google Places…';
    try{
      await loadGoogleMaps(googleKey());
      const lib=await window.google.maps.importLibrary('places');
      if(!mount.isConnected || !mount.id)return;
      if(!lib.PlaceAutocompleteElement)throw Error('Google Places autocomplete is not available. Check that Places API (New) is enabled.');
      const picker = new lib.PlaceAutocompleteElement({includedPrimaryTypes:['hotel','resort_hotel','lodging','guest_house','hostel']});
      picker.setAttribute('placeholder','Search hotel or resort by name…');
      picker.setAttribute('aria-label','Search hotel using Google Places');
      picker.className='google-hotel-picker';
      mount.replaceChildren(picker);
      if(status)status.textContent='Select a hotel from the suggestions to fill its name and address.';
      picker.addEventListener('gmp-select',async ({placePrediction})=>{
        const current=active();
        try {
          if(status)status.textContent='Loading selected hotel…';
          const place=placePrediction.toPlace();
          await place.fetchFields({fields:['displayName','formattedAddress']});
          if(!place.displayName)throw Error('Google did not return a hotel name.');
          const foundName=place.displayName, foundAddress=place.formattedAddress||'';
          modal('Confirm hotel selection',`<strong>${esc(foundName)}</strong><br>${esc(foundAddress)}<br><br>Check the hotel against the supplier booking before using these details in the customer itinerary.`,[
            {label:'Cancel'},
            {label:'Use confirmed hotel',primary:true,action:()=>{
              current.hotel.name=foundName;
              if(foundAddress)current.hotel.address=foundAddress;
              current.updatedAt=new Date().toISOString();
              state.hotelSearchOpen=false;
              save();render();showToast('Hotel details added. Fill confirmed room and meal arrangements.');
            }}
          ]);
        }catch(e){if(status)status.textContent='Could not fetch hotel details: '+e.message;showToast('Google hotel lookup failed. You can still enter details manually.');}
      });
      picker.addEventListener('gmp-error',()=>{if(status)status.textContent='Google returned an error. Check key, allowed referrers and billing.';});
    }catch(e){
      if(status)status.textContent=String(e.message||e);
      mount.dataset.loading='';
      showToast('Google search unavailable. Manual hotel entry still works.');
    }
  }
  function renderHotelSearch(){
    const key=googleKey();
    if(!key) return card('Google hotel search (optional)','Set up once, then select hotels instead of typing their names.',
      `<div class="google-hotel-setup"><label for="googleKeyInput" class="quick-label">Google Maps browser API key</label><input type="password" id="googleKeyInput" autocomplete="off" spellcheck="false" placeholder="Paste a restricted Google Maps API key"/><button type="button" class="btn btn-primary btn-mini" data-action="save-google-key">Enable hotel search</button></div><p class="field-help">Enable Maps JavaScript API and Places API (New), and restrict this browser key to your GitHub Pages domain. Billing must be enabled. Without a key, manual entry still works.</p>`,'globe');
    return card('Find a hotel with Google','Optional quick search; room configuration and meals remain manual.',
      `<div class="google-hotel-actions"><span class="google-key-ok">${icon('check',true)} Google key configured on this browser</span><button type="button" class="btn btn-quiet btn-mini" data-action="clear-google-key">Remove key</button></div>`+
      (state.hotelSearchOpen ? `<div id="googleHotelSearchMount" class="google-hotel-mount"></div><p id="googleHotelSearchStatus" role="status" class="field-help">Preparing hotel search…</p>` : `<button type="button" class="btn btn-primary" data-action="open-google-hotel">${icon('hotel',true)} Search hotels with Google</button>`)+
      `<p class="field-help">Google only supplies the selected hotel's name and address. Prices, availability, rooms and photographs are not fetched. Confirm all details before sending the itinerary.</p>`,'globe');
  }
  const I = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    trip: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    hotel: '<path d="M3 21V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v16M3 21h18M8 7h3M8 11h3M8 15h3M15 11h6v10M7 21v-4h7v4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v4h16v-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    arrowleft: '<path d="m15 18-6-6 6-6"/>',
    arrowright: '<path d="m9 18 6-6-6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
    spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    time: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  };
  const icon = (name, small = false) => `<svg aria-hidden="true" class="icon${small ? ' small' : ''}" viewBox="0 0 24 24">${I[name] || I.info}</svg>`;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const attr = esc;
  const id = () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const copy = value => JSON.parse(JSON.stringify(value));
  const safeImage = value => /^(assets\/[a-z0-9_.\-/]+|data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+)$/i.test(String(value||'')) ? value : '';
  const get = (obj, path) => path.split('.').reduce((v,k) => v?.[k], obj);
  const set = (obj, path, value) => {const parts=path.split('.');let node=obj;for(let i=0;i<parts.length-1;i++){if(!node[parts[i]])return;node=node[parts[i]];}node[parts.at(-1)]=value;};
  const toDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !isNaN(new Date(`${s}T12:00:00Z`).getTime()) ? new Date(`${s}T12:00:00Z`) : null;
  const plusDays = (s,n) => {let d=toDate(s);if(!d)return s;d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const dateDiff = (from,to) => {const a=toDate(from), b=toDate(to);if(!a||!b)return null;return Math.round((b-a)/86400000);};
  const fmtDate = (s, opts={day:'numeric',month:'short',year:'numeric'}) => {const d=toDate(s);return d?d.toLocaleDateString('en-GB',{...opts,timeZone:'UTC'}):'Date not set';};
  const fmtDay = s => fmtDate(s,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const today = () => {let d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const categories = ['Activity','Transfer','Hotel','Flight','Meal','Visa','Other'];
  const mealOptions = ['Not included','Included','Included at hotel','Restaurant coupon','Optional','At own expense'];
  const field = (label,path,value,opts={}) => {
    const type=opts.type||'text', full=opts.full?' full':'',help=opts.help?`<small class="field-help">${esc(opts.help)}</small>`:'',required=opts.required?' <span style="color:#ba5376">*</span>':'';
    let control;
    if(opts.options){control=`<select data-field="${attr(path)}">${opts.options.map(o=>`<option value="${attr(o)}" ${String(value??'')===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;}
    else if(type==='textarea')control=`<textarea data-field="${attr(path)}" rows="${opts.rows||3}" maxlength="${opts.maxlength||7000}" placeholder="${attr(opts.placeholder||'')}">${esc(value)}</textarea>`;
    else control=`<input type="${attr(type)}" data-field="${attr(path)}" value="${attr(value??'')}" ${opts.min!==undefined?`min="${opts.min}"`:''} ${opts.max!==undefined?`max="${opts.max}"`:''} ${opts.step!==undefined?`step="${opts.step}"`:''} maxlength="${opts.maxlength||250}" placeholder="${attr(opts.placeholder||'')}" />`;
    return `<div class="field${full}"><label>${esc(label)}${required}</label>${control}${help}</div>`;
  };
  const card = (title,desc,body,symbol='file') => `<div class="section-card"><div class="card-head"><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div><span class="card-symbol">${icon(symbol)}</span></div>${body}</div>`;
  const info = (text, warning=false) => `<div class="info-stripe${warning?' warning':''}">${icon('info',true)}<div>${text}</div></div>`;

  function blankEvent(type='Activity') {return {id:id(),type,name:'',time:'',duration:'',transfer:'',tickets:'',description:'',notes:''};}
  function blankDay(n=0) {return {id:id(),title:'',overview:'',events:[],meals:{breakfast:'Not included',lunch:'Not included',dinner:'Not included'},overnight:''};}
  function makeBlank(){
    const start=today();return {
      id:id(),schemaVersion:1,quickText:'',reference:`AB-${String(Date.now()).slice(-6)}`,status:'Draft',customer:'',tripTitle:'Your next journey',destination:'',country:'',startDate:start,endDate:plusDays(start,4),adults:2,children:0,childrenAges:'',rooms:1,
      arrivalInfo:'',departureInfo:'',coverImage:'',preparedBy:{name:'',role:'Travel Consultant',phone:'',email:''},
      brand:{name:'Al Bahar Tours & Travels',tagline:'Discover the World with Us!',logo:ASSETS.logo,phone:'',email:'',website:''},
      hotel:{name:'',address:'',roomType:'',board:'Breakfast included',checkIn:start,checkOut:plusDays(start,4),description:'',highlights:'',notes:'',photos:[]},
      days:Array.from({length:5},(_,i)=>blankDay(i)),disclaimer:'This itinerary is a preliminary travel proposal. Services, timings, reservations and inclusions are subject to confirmation. Please review all details before travel.',updatedAt:new Date().toISOString()
    };
  }
  function sample(){
    const t=makeBlank();
    Object.assign(t,{reference:'DEMO-8916863',status:'Draft',customer:'Sample Traveller',tripTitle:'Trip to Dubai',destination:'Dubai',country:'United Arab Emirates',startDate:'2026-11-13',endDate:'2026-11-17',adults:4,children:2,childrenAges:'3, 8',rooms:2,coverImage:'',arrivalInfo:'Arrival flight details to be confirmed.',departureInfo:'Departure flight details to be confirmed.'});
    t.preparedBy={name:'Demo Consultant',role:'Travel Consultant',phone:'',email:''};
    t.hotel={name:'Crowne Plaza Dubai Deira by IHG',address:'Salahuddin Road, Deira, Dubai',roomType:'2 × Deluxe Rooms',board:'Breakfast included',checkIn:'2026-11-13',checkOut:'2026-11-17',description:'Located in Dubai’s Deira district, Crowne Plaza Dubai Deira offers comfortable rooms and convenient access to city attractions and local shopping.',highlights:'Contemporary rooms and comfortable seating\nOn-site dining options and facilities\nConvenient access to Al Rigga Metro Station\nNearby shopping and restaurants',notes:'Property charges, including any applicable local tourism taxes, are payable according to the hotel’s policy.',photos:[]};
    const E=(type,name,time,description,transfer='',tickets='',notes='')=>({id:id(),type,name,time,duration:'',description,transfer,tickets,notes});
    t.days=[
      {id:id(),title:'Arrival · Hotel Check-in · Dhow Cruise',overview:'Welcome to Dubai. Meet the representative at the airport and travel to your hotel. Enjoy a relaxing evening on a traditional creek cruise with dinner.',events:[E('Transfer','Airport to Hotel · Private Transfer','Upon arrival','One-way transfer from Dubai International Airport to Crowne Plaza Dubai Deira.','Private transfers'),E('Activity','Dhow Cruise with Dinner · Creek Cruise','7:00 PM','Evening Dhow Cruise Creek experience with buffet dinner and return transfers.','Private transfers','Dinner & cruise ticket')],meals:{breakfast:'Not included',lunch:'Not included',dinner:'Included'},overnight:'Crowne Plaza Dubai Deira'},
      {id:id(),title:'Abu Dhabi City Tour',overview:'Explore the highlights of Abu Dhabi, including its celebrated Grand Mosque and major city landmarks.',events:[E('Activity','Abu Dhabi City Tour with BAPS Hindu Mandir Visit','9:00 AM','Full-day Abu Dhabi sightseeing tour with stops at major attractions and the Sheikh Zayed Grand Mosque.','Shared transfers','City tour')],meals:{breakfast:'Included at hotel',lunch:'Not included',dinner:'Restaurant coupon'},overnight:'Crowne Plaza Dubai Deira'},
      {id:id(),title:'Miracle Garden · Burj Khalifa',overview:'Spend the day experiencing two iconic Dubai highlights: Dubai Miracle Garden and the spectacular views from Burj Khalifa.',events:[E('Activity','Dubai Miracle Garden','9:00 AM','Visit Dubai Miracle Garden with admission tickets and transfers.','Private transfers','General admission ticket'),E('Activity','Burj Khalifa · At The Top, 124th Floor','3:30 PM','Enjoy panoramic city views from the observation deck. Non-prime-hour admission, subject to the confirmed ticket slot.','Private transfers','124th Floor admission')],meals:{breakfast:'Included at hotel',lunch:'Not included',dinner:'Restaurant coupon'},overnight:'Crowne Plaza Dubai Deira'},
      {id:id(),title:'Dubai City Tour · Desert Safari',overview:'Explore Dubai’s city highlights in the morning, followed by a memorable evening in the desert.',events:[E('Activity','Half-Day Dubai City Tour','9:00 AM','Morning Dubai sightseeing in a private vehicle, visiting selected landmarks and markets.','Private transfers'),E('Activity','Desert Safari · Dune Bashing & BBQ Dinner','2:30 PM','Afternoon desert safari including dune bashing, entertainment and BBQ dinner.','Private transfers','Desert safari & dinner')],meals:{breakfast:'Included at hotel',lunch:'Not included',dinner:'Included'},overnight:'Crowne Plaza Dubai Deira'},
      {id:id(),title:'Departure from Dubai',overview:'Check out from the hotel and travel to the airport for your return journey.',events:[E('Transfer','Hotel to Airport · Private Transfer','To be confirmed','One-way private transfer from Crowne Plaza Dubai Deira to Dubai International Airport.','Private transfers')],meals:{breakfast:'Included at hotel',lunch:'Not included',dinner:'Not included'},overnight:''}
    ];
    return t;
  }
  function hydrateTrip(raw){
    const d=makeBlank(); if(!raw || typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid itinerary file.');
    for(const key of ['id','reference','status','customer','tripTitle','destination','country','startDate','endDate','childrenAges','arrivalInfo','departureInfo','coverImage','disclaimer','quickText'])if(typeof raw[key]==='string')d[key]=raw[key].slice(0,key==='disclaimer'?8000:15000);
    for(const key of ['adults','children','rooms'])if(Number.isFinite(Number(raw[key])))d[key]=Math.max(0,Math.min(10000,Number(raw[key])));
    for(const key of ['preparedBy','brand','hotel'])if(raw[key]&&typeof raw[key]==='object'&&!Array.isArray(raw[key])){
      for(const fieldName of Object.keys(d[key])){if(fieldName==='photos'){if(Array.isArray(raw[key].photos))d[key].photos=raw[key].photos.filter(s=>typeof s==='string'&&safeImage(s)).slice(0,6);}
        else if(typeof raw[key][fieldName]==='string')d[key][fieldName]=raw[key][fieldName].slice(0,40000);}
    }
    if(Array.isArray(raw.days))d.days=raw.days.slice(0,30).map(a=>({id:String(a.id||id()),title:String(a.title||''),overview:String(a.overview||''),overnight:String(a.overnight||''),meals:{breakfast:String(a.meals?.breakfast||'Not included'),lunch:String(a.meals?.lunch||'Not included'),dinner:String(a.meals?.dinner||'Not included')},events:Array.isArray(a.events)?a.events.slice(0,35).map(e=>{const x=blankEvent();for(const k of Object.keys(x))if(typeof e[k]==='string')x[k]=e[k];return x;}):[]}));
    if(!d.days.length)d.days=[blankDay()];
    d.id ||= id();d.brand.logo=safeImage(d.brand.logo)||ASSETS.logo;d.coverImage=safeImage(d.coverImage);if(d.coverImage==='assets/dubai-skyline.jpg')d.coverImage='';d.updatedAt=new Date().toISOString();
    return d;
  }
  let state={trips:[],activeId:'',tab:'quick',dayIndex:0,previewKey:'cover',mobileView:'edit',hotelSearchOpen:false};
  function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');if(raw?.trips?.length){state.trips=raw.trips.slice(0,50).map(hydrateTrip);state.activeId=state.trips.find(t=>t.id===raw.activeId)?.id||state.trips[0].id;return;}}catch(e){console.warn('Could not read saved itineraries',e);}const first=sample();state.trips=[first];state.activeId=first.id;save();}
  function active(){return state.trips.find(t=>t.id===state.activeId)||state.trips[0];}
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify({trips:state.trips,activeId:state.activeId}));const node=document.getElementById('saveStatus');if(node)node.innerHTML='<span class="save-dot"></span> Saved locally';return true;}catch(e){showToast('Browser storage is full. Export JSON to protect your work.');const node=document.getElementById('saveStatus');if(node)node.textContent='Storage full';return false;}}
  let timer;
  function showToast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),3800);}
  function modal(title,text,buttons){const root=document.getElementById('modalRoot');root.hidden=false;root.innerHTML=`<div class="modal-box" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${text}</p><div class="modal-footer">${buttons.map((b,i)=>`<button type="button" class="btn ${b.primary?'btn-primary':b.danger?'btn-danger':'btn-outline'}" data-modal-index="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;root.querySelectorAll('[data-modal-index]').forEach(btn=>btn.addEventListener('click',()=>{root.hidden=true;root.innerHTML='';buttons[Number(btn.dataset.modalIndex)].action?.();}));}
  function renderNav(){
    const choices=[['quick','Quick create','spark'],['trip','Trip details','trip'],['hotel','Hotel & stay','hotel'],['days','Day-by-day plan','calendar'],['branding','Branding & contact','user']];
    document.getElementById('mainNav').innerHTML=choices.map(([tab,label,ico])=>`<button class="nav-btn ${state.tab===tab?'active':''}" data-action="tab" data-tab="${tab}">${icon(ico)}<span>${label}</span>${state.tab===tab?`<span class="nav-arrow">${icon('chevron',true)}</span>`:''}</button>`).join('');
    document.getElementById('savedTripList').innerHTML=state.trips.map(t=>`<button class="saved-trip ${t.id===state.activeId?'active':''}" data-action="open-trip" data-id="${attr(t.id)}"><span class="saved-trip-icon">${icon('file',true)}</span><span><strong>${esc(t.tripTitle||'Untitled itinerary')}</strong><small>${esc(t.customer||'No customer')} · ${esc(t.reference||'No ref')}</small></span></button>`).join('');
  }
  function top(title,description,action=''){
    const t=active();return `<div class="breadcrumb"><span>My workspace</span>${icon('chevron',true)}<span class="crumb-current">${esc(t.tripTitle||'Untitled itinerary')}</span></div><div class="editor-header"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</div>`;
  }
  function actions(nextTab,nextText='Continue'){
    return `<div class="editor-actions"><button class="btn btn-quiet" data-action="duplicate-trip">${icon('copy',true)} Duplicate itinerary</button><button class="btn btn-primary" data-action="tab" data-tab="${nextTab}">${esc(nextText)} ${icon('arrowright',true)}</button></div>`;
  }
  function renderCoverPicker(t){
    const d=catalogDestination(t), images=catalogImages(d), chosen=coverFor(t);
    const grid=images.length?`<div class="destination-gallery">${images.map((im,i)=>`<button type="button" class="destination-choice ${chosen===im.src?'selected':''}" data-action="select-cover" data-src="${attr(im.src)}" aria-pressed="${chosen===im.src?'true':'false'}"><span class="destination-thumb"><img loading="lazy" src="${attr(im.src)}" alt="${esc(im.label)}"/><span class="destination-check">${icon('check',true)}</span></span><span class="destination-caption">${esc(im.label)}</span></button>`).join('')}</div>`:
      `<div class="destination-empty">${icon('globe')} <div><strong>No bundled cover for this destination yet</strong><p>Upload an image below, or add this destination to the source image catalog later.</p></div></div>`;
    const custom=safeImage(t.coverImage) && t.coverImage.startsWith('data:');
    return `<div class="cover-library-head"><div><span class="eyebrow">BUNDLED COVER COLLECTION</span><h4>${esc(d?.name||'Select a destination')}</h4><p>${images.length?`${images.length} curated cover compositions available. Select one or keep the default.`:'Try Kashmir, Kerala, Dubai or Bali to see the built-in collection.'}</p></div><span class="library-status">No API required</span></div>${grid}`+
      `${custom?`<div class="custom-cover-selected"><img src="${attr(safeImage(t.coverImage))}" alt="Uploaded cover image"/><div><strong>Custom photo selected</strong><p>Your uploaded image will be used in the document.</p></div><button class="btn btn-mini btn-quiet" type="button" data-action="reset-cover">Use library</button></div>`:''}`+
      `<label class="small-upload cover-upload">${icon('image',true)} Upload a different cover image <input type="file" data-upload="cover" accept="image/png,image/jpeg,image/webp" /></label><p class="field-help">Bundled images are original AI-generated illustrations for the demo, not verified documentary photographs. Replace with approved travel photography for production.</p>`;
  }
  function renderTrip(){const t=active();return top('Trip details','Start with your customer and journey information.',`<span class="pill-label">${esc(t.status)}</span>`)+
    card('Customer information','Who is this itinerary being prepared for?',`<div class="form-grid">${field('Customer / family name','customer',t.customer,{placeholder:'e.g. Narvekar',required:true})}${field('Reference number','reference',t.reference,{placeholder:'e.g. 8916863'})}${field('Itinerary title','tripTitle',t.tripTitle,{full:true,placeholder:'e.g. Trip to Dubai'})}</div>`,'user')+
    card('Destination & travel dates','The day-by-day plan adjusts when dates change.',`<div class="form-grid">${field('Destination / city','destination',t.destination,{placeholder:'e.g. Dubai',required:true})}${field('Country / region','country',t.country,{placeholder:'e.g. United Arab Emirates'})}${field('Departure date','startDate',t.startDate,{type:'date',required:true})}${field('Return date','endDate',t.endDate,{type:'date',required:true})}</div><div class="section-divider"></div><div class="form-grid cols-3">${field('Adults','adults',t.adults,{type:'number',min:0,max:200})}${field('Children','children',t.children,{type:'number',min:0,max:200})}${field('Rooms','rooms',t.rooms,{type:'number',min:0,max:200})}</div><div class="section-divider"></div><div class="form-grid">${field('Children ages (optional)','childrenAges',t.childrenAges,{placeholder:'e.g. 3, 8'})}<div class="field"><label>Trip duration</label><div class="info-stripe">${icon('calendar',true)} ${esc(durationLabel(t))}</div></div></div>`,'calendar')+
    card('Destination cover collection','Cover images are suggested automatically for your selected destination. No image API needed.',renderCoverPicker(t),'image')+
    card('Travel information','Optional arrival and departure notes.',`<div class="form-grid cols-1">${field('Arrival information','arrivalInfo',t.arrivalInfo,{type:'textarea',placeholder:'Arrival flight information or special pickup instructions'})}${field('Departure information','departureInfo',t.departureInfo,{type:'textarea',placeholder:'Departure flight information or airport transfer instructions'})}</div>`,'trip')+actions('hotel','Continue to hotel');}
  function renderHotel(){const t=active(),h=t.hotel;return top('Hotel & stay','Find a hotel with Google or enter details manually.')+
    renderHotelSearch()+
    card('Accommodation details','Displayed on the dedicated hotel information page.',`<div class="form-grid">${field('Hotel name','hotel.name',h.name,{full:true,placeholder:'e.g. Crowne Plaza Dubai Deira'})}${field('Location / address','hotel.address',h.address,{full:true,placeholder:'Street / area / city'})}${field('Check-in','hotel.checkIn',h.checkIn,{type:'date'})}${field('Check-out','hotel.checkOut',h.checkOut,{type:'date'})}${field('Room configuration','hotel.roomType',h.roomType,{placeholder:'e.g. 2 × Deluxe Rooms'})}${field('Meal plan','hotel.board',h.board,{placeholder:'e.g. Breakfast included'})}</div>`,'hotel')+
    `<details class="hotel-optional-details"><summary>Optional hotel descriptions, highlights & notes</summary>${card('Hotel introduction','Only add text if the customer itinerary requires it.',`<div class="form-grid cols-1">${field('Hotel overview','hotel.description',h.description,{type:'textarea',rows:4,placeholder:'Optional hotel overview'})}${field('Property highlights','hotel.highlights',h.highlights,{type:'textarea',rows:4,placeholder:'Optional highlights, one per line'})}${field('Important hotel notes','hotel.notes',h.notes,{type:'textarea',rows:3,placeholder:'Optional property notes'})}</div>`,'file')}</details>`+
    card('Photo-free premium layout','The customer PDF uses a designed accommodation summary instead of hotel photo placeholders.',`<div class="clean-stay-callout">${icon('check')}<div><strong>No hotel gallery required</strong><p>Hotel name, dates, room details, meal plan, description and important notes will be styled as a premium travel proposal. Adding or changing hotels requires no image uploads.</p></div></div>`,'spark')+actions('days','Build daily itinerary');}
  function renderEvent(dayIndex,e,i){const prefix=`days.${dayIndex}.events.${i}`;return `<div class="activity-card"><div class="activity-card-header"><span class="activity-index">${String(i+1).padStart(2,'0')}</span><strong>${esc(e.name||'New activity')}</strong><div class="activity-actions"><button title="Move up" data-action="move-event-up" data-event="${i}" ${i===0?'disabled':''}>${icon('up',true)}</button><button title="Move down" data-action="move-event-down" data-event="${i}" ${i===active().days[dayIndex].events.length-1?'disabled':''}>${icon('down',true)}</button><button title="Duplicate" data-action="duplicate-event" data-event="${i}">${icon('copy',true)}</button><button title="Remove" data-action="remove-event" data-event="${i}">${icon('trash',true)}</button></div></div><div class="activity-card-body"><div class="form-grid">${field('Service type',`${prefix}.type`,e.type,{options:categories})}${field('Pickup / start time',`${prefix}.time`,e.time,{placeholder:'e.g. 9:00 AM'})}${field('Activity / service name',`${prefix}.name`,e.name,{full:true,placeholder:'e.g. Abu Dhabi City Tour'})}${field('Description',`${prefix}.description`,e.description,{full:true,type:'textarea',rows:3,placeholder:'Customer-facing description of the activity'})}${field('Transfer arrangement',`${prefix}.transfer`,e.transfer,{placeholder:'e.g. Private transfers'})}${field('Tickets / inclusions',`${prefix}.tickets`,e.tickets,{placeholder:'e.g. Entry ticket included'})}${field('Duration (optional)',`${prefix}.duration`,e.duration,{placeholder:'e.g. 4 hours'})}${field('Extra notes',`${prefix}.notes`,e.notes,{placeholder:'Any important conditions'})}</div></div></div>`;}
  function renderDays(){const t=active();state.dayIndex=Math.max(0,Math.min(state.dayIndex,t.days.length-1));const n=state.dayIndex,d=t.days[n],date=plusDays(t.startDate,n);return top('Day-by-day plan',`${t.days.length} days of travel · add and arrange activities however you like.`,`<span class="pill-label">${t.days.length} days</span>`)+
    `<div class="day-tab-row">${t.days.map((d,i)=>`<button type="button" class="day-tab ${i===n?'active':''}" data-action="pick-day" data-index="${i}">Day ${i+1}</button>`).join('')}</div>`+
    `<div class="edit-banner"><span class="edit-banner-icon">${icon('calendar')}</span><div><h3>Day ${n+1} <span class="small-meta">· ${esc(fmtDay(date))}</span></h3><p>This day automatically appears in the PDF and itinerary summary.</p></div></div>`+
    card(`Day ${n+1} — Plan`,`Give this day a clear title and a short introduction.`,`<div class="form-grid cols-1">${field('Day heading',`days.${n}.title`,d.title,{placeholder:'e.g. Abu Dhabi City Tour'})}${field('Day description / introduction',`days.${n}.overview`,d.overview,{type:'textarea',rows:3,placeholder:'What will guests experience today?'})}</div>`,'trip')+
    card(`Activities & services (${d.events.length})`,'Enter any activity, transfer, hotel, visa or meal. No catalog needed.',`${d.events.map((e,i)=>renderEvent(n,e,i)).join('')}<button type="button" class="add-activity" data-action="add-event">${icon('plus',true)} &nbsp; Add activity / service</button>`,'spark')+
    card('Meals & overnight stay','Shown at the bottom of this day in the PDF.',`<div class="form-grid cols-3">${field('Breakfast',`days.${n}.meals.breakfast`,d.meals.breakfast,{options:mealOptions})}${field('Lunch',`days.${n}.meals.lunch`,d.meals.lunch,{options:mealOptions})}${field('Dinner',`days.${n}.meals.dinner`,d.meals.dinner,{options:mealOptions})}</div><div style="margin-top:17px">${field('Overnight stay',`days.${n}.overnight`,d.overnight,{placeholder:'e.g. Crowne Plaza Dubai Deira'})}</div>`,'hotel')+
    `<div class="editor-actions"><div class="day-toolbar"><button class="btn btn-quiet btn-mini" data-action="duplicate-day">${icon('copy',true)} Copy this day</button><button class="btn btn-danger btn-mini" data-action="clear-day">${icon('trash',true)} Clear day</button></div><button class="btn btn-primary" data-action="${n<t.days.length-1?'next-day':'tab'}" ${n<t.days.length-1?'':'data-tab="branding"'}>${n<t.days.length-1?'Next day':'Branding & contact'} ${icon('arrowright',true)}</button></div>`;
  }
  function renderBranding(){const t=active();return top('Branding & contact','Personalize every document with your agency and consultant information.')+
    card('Agency identity','These details appear automatically throughout your PDF.',`<div class="form-grid">${field('Business name','brand.name',t.brand.name,{full:true})}${field('Business tagline','brand.tagline',t.brand.tagline,{full:true})}${field('Contact number','brand.phone',t.brand.phone,{placeholder:'+91 ...'})}${field('Company email','brand.email',t.brand.email,{type:'email'})}${field('Website','brand.website',t.brand.website,{full:true,placeholder:'www.example.com'})}</div><div class="section-divider"></div><div class="subheading">COMPANY LOGO</div><label class="image-drop has-image"><input type="file" data-upload="logo" accept="image/png,image/jpeg,image/webp" aria-label="Change company logo" />${safeImage(t.brand.logo)?`<img src="${attr(safeImage(t.brand.logo))}" alt="Company logo" />`:`${icon('image')}<strong>Upload logo</strong>`}<small>Click to replace the company logo</small></label><button style="margin-top:10px" class="btn btn-mini btn-quiet" data-action="reset-logo">Restore Al Bahar logo</button>`,'hotel')+
    card('Prepared by','Use the employee who prepared this itinerary.',`<div class="form-grid">${field('Employee name','preparedBy.name',t.preparedBy.name,{placeholder:'e.g. Shadab Siddiqui'})}${field('Designation','preparedBy.role',t.preparedBy.role,{placeholder:'Travel consultant'})}${field('Employee phone','preparedBy.phone',t.preparedBy.phone,{placeholder:'+91 ...'})}${field('Employee email','preparedBy.email',t.preparedBy.email,{type:'email',placeholder:'consultant@example.com'})}</div>`,'user')+
    card('Proposal note','Shown at the end of the prepared-for page.',`<div class="form-grid cols-1">${field('Terms / disclaimer','disclaimer',t.disclaimer,{type:'textarea',rows:4})}</div>`,'file')+
    info('This demo has no user authentication. Employee details are editable. In Phase 2, they can be read automatically from staff logins.')+
    `<div class="editor-actions"><button class="btn btn-quiet" data-action="download-json">${icon('download',true)} Back up itinerary</button><button class="btn btn-primary" data-action="print">${icon('file',true)} Export customer PDF</button></div>`;
  }
  // Quick Create removes repetitive entry. Full editor remains available for exceptional cases.
  // These are *unconfirmed planning ideas*, never factual claims about available tickets or bookings.
  const STARTER_PLANS={
    dubai:[['Arrival and hotel check-in','Arrival / airport transfer','Evening at leisure'],['Dubai sightseeing','Dubai City Tour','Explore local attractions'],['Dubai highlights','Burj Khalifa','Dubai Miracle Garden'],['Desert experience','Desert Safari'],['Departure','Hotel checkout','Airport transfer']],
    kashmir:[['Arrival in Srinagar','Arrival and hotel check-in','Dal Lake visit'],['Gulmarg excursion','Gulmarg sightseeing'],['Pahalgam excursion','Pahalgam sightseeing'],['Srinagar sightseeing','Local sightseeing','Shopping / leisure time'],['Departure','Hotel checkout','Airport transfer']],
    kerala:[['Arrival in Kochi','Arrival and hotel check-in','Local sightseeing'],['Munnar visit','Munnar sightseeing','Tea plantation visit'],['Thekkady','Scenic drive to Thekkady','Leisure time'],['Backwaters','Alleppey backwater visit'],['Departure','Hotel checkout','Departure transfer']],
    bali:[['Arrival in Bali','Arrival and hotel check-in'],['Ubud exploration','Ubud sightseeing','Rice terrace visit'],['Temple visits','Local temple sightseeing'],['Coastal experiences','Beach and coastal sightseeing'],['Departure','Hotel checkout','Airport transfer']]
  };
  const quickExample=`Day 1 - Arrival in Dubai\n- Airport pickup\n- Hotel check-in\n- Dhow Cruise with Dinner\n\nDay 2 - Abu Dhabi City Tour\n- 9:00 AM - Abu Dhabi sightseeing\n- Grand Mosque visit\n\nDay 3 - Burj Khalifa\n- Burj Khalifa visit\n- Dubai Miracle Garden`;
  function quickSummary(t){return t.days.map((d,i)=>`<div class="quick-day-line"><span>DAY ${i+1}</span><div><strong>${esc(d.title||'Not planned')}</strong><small>${d.events.length} activities</small></div><button class="quick-edit-link" data-action="edit-quick-day" data-index="${i}">Edit</button></div>`).join('');}
  function renderQuick(){
    const t=active(),dest=catalogDestination(t),n=t.days.length;
    return top('Create itinerary, faster','Only the essentials first. No need to fill every form or search for hotel photographs.',`<span class="pill-label">QUICK CREATE</span>`)+
      `<div class="quick-intro"><div class="quick-step-num">01</div><div><strong>Enter four essentials</strong><p>Everything else is optional; the reference, duration, cover and layout are automatic.</p></div></div>`+
      `<div class="quick-main-card"><div class="form-grid">${field('Customer name','customer',t.customer,{placeholder:'Name to appear on PDF',required:true})}${field('Destination','destination',t.destination,{placeholder:'Dubai, Kashmir, Kerala...',required:true})}${field('Start date','startDate',t.startDate,{type:'date'})}${field('End date','endDate',t.endDate,{type:'date'})}</div><div class="quick-collapsed"><div>${icon('check',true)} ${esc(durationLabel(t))} · ${esc(t.reference)}</div><div>${dest?`Cover automatically selected: ${esc(dest.name)}`:'Destination cover can be uploaded later'}</div></div></div>`+
      `<div class="quick-intro"><div class="quick-step-num">02</div><div><strong>Add the plan in one go</strong><p>Paste a day-wise plan from the supplier or use a starter outline. Each bullet becomes an activity.</p></div></div>`+
      `<div class="quick-main-card"><label class="quick-label" for="quickPlanInput">Paste day-wise plan (any destination)</label><textarea id="quickPlanInput" data-quick-plan rows="9" placeholder="${attr(quickExample)}">${esc(t.quickText||'')}</textarea><div class="quick-hint">Supported: “Day 1 - Arrival”, followed by one activity per line. Add optional times like “9:00 AM - City Tour”. No AI, API or login needed.</div><div class="quick-row"><button type="button" class="btn btn-primary" data-action="apply-quick-plan">${icon('check',true)} Build days from text</button><button type="button" class="btn btn-quiet" data-action="load-quick-example">Insert example format</button></div>${dest&&STARTER_PLANS[dest.id]?`<div class="quick-template"><strong>Planning shortcut for ${esc(dest.name)}</strong><p>Use a generic 5-day starter with editable activity names. These are suggestions, not confirmed arrangements.</p><button class="btn btn-quiet btn-mini" type="button" data-action="quick-template">Use ${esc(dest.name)} starter outline</button></div>`:''}</div>`+
      `<div class="quick-intro"><div class="quick-step-num">03</div><div><strong>Review and export</strong><p>${n} days are ready. You can adjust any day, or add hotel and transfer details only when needed.</p></div></div>`+
      `<div class="quick-main-card"><div class="quick-day-list">${quickSummary(t)}</div><div class="quick-row"><button class="btn btn-quiet" data-action="tab" data-tab="hotel">${icon('hotel',true)} Optional hotel details</button><button class="btn btn-quiet" data-action="tab" data-tab="branding">${icon('user',true)} Consultant details</button><button class="btn btn-quiet" data-action="tab" data-tab="trip">Advanced fields</button></div><div class="quick-row quick-export-row"><button class="btn btn-primary" data-action="print">${icon('file',true)} Preview / Export PDF</button></div><p class="quick-hint">The PDF contains only details entered or confirmed by your team. Blank optional sections are not invented.</p></div>`;
  }
  function planFromText(text,t){
    const lines=String(text||'').replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
    if(!lines.length)return {error:'Paste a day-wise plan first.'};
    if(lines.length>900)return {error:'The plan is too long. Please use up to 900 lines.'};
    const parsed=[];let current=null;let implicit=false;
    for(let line of lines){
      const match=line.match(/^day\s*0*(\d{1,2})(?:\s*\([^)]{0,50}\))?\s*(?:[:.\-–—|)]\s*)?(.*)$/i);
      if(match){const dayNumber=Number(match[1]);if(dayNumber<1||dayNumber>30)return {error:'Only Day 1 through Day 30 are supported.'};if(parsed.some(d=>d.number===dayNumber))return {error:`Day ${dayNumber} appears more than once. Please correct the headings.`};
        current={number:dayNumber,title:(match[2]||'').trim(),events:[]};parsed.push(current);implicit=false;continue;}
      if(!current){current={number:1,title:'',events:[]};parsed.push(current);implicit=true;}
      line=line.replace(/^\s*(?:[•*\-–]|\d+[.)])\s+/,'').trim();
      if(!line)continue;
      let time='';const timed=line.match(/^((?:0?[1-9]|1[0-2])(?::[0-5]\d)?\s*(?:AM|PM))\s*[:\-–—]\s*(.+)$/i);
      if(timed){time=timed[1].trim();line=timed[2].trim();}
      if(line.length>180 && current.events.length){current.events.at(-1).description=(current.events.at(-1).description?current.events.at(-1).description+'\n':'')+line;continue;}
      if(current.events.length<35)current.events.push({name:line.slice(0,250),time});
    }
    if(!parsed.length)return {error:'No activities found.'};
    let max=Math.max(...parsed.map(x=>x.number));
    if(implicit){max=1;}
    if(max>t.days.length)return {error:`The pasted plan has Day ${max}, but the trip dates cover ${t.days.length} days. Adjust the return date first.`};
    const days=Array.from({length:t.days.length},(_,i)=>blankDay(i));
    for(const block of parsed){const d=days[block.number-1];d.title=block.title||block.events[0]?.name||`Day ${block.number}`;
      d.events=block.events.map(x=>({...blankEvent(),name:x.name,time:x.time}));
      // Preserve a supplied day title when no bullet activities were provided.
      if(!d.events.length&&block.title)d.events=[{...blankEvent(),name:block.title}];
    }
    return {days:days.slice(0,30),parsed:parsed.length};
  }
  function applyParsedPlan(result){
    const t=active();t.days=result.days;
    if(!t.hotel.checkIn)t.hotel.checkIn=t.startDate;
    if(!t.tripTitle||t.tripTitle==='Your next journey')t.tripTitle=`Trip to ${t.destination||'your destination'}`;
    t.updatedAt=new Date().toISOString();state.dayIndex=0;state.previewKey='day:0:0';save();render();showToast(`${result.parsed} planned day${result.parsed===1?'':'s'} added. Review before sending.`);
  }
  function confirmPlanReplacement(result){const t=active();if(t.days.some(d=>d.events.length||d.title)){
      modal('Replace existing daily plan?',`This will replace the ${t.days.length} day plan and its activities. Customer and hotel details will be retained.`,[
        {label:'Keep existing plan'}, {label:'Replace plan',primary:true,action:()=>applyParsedPlan(result)}]);
    }else applyParsedPlan(result);
  }
  function applyStarter(){const t=active(),dest=catalogDestination(t),rows=STARTER_PLANS[dest?.id];if(!rows){showToast('Choose Dubai, Kashmir, Kerala or Bali for a starter outline.');return;}
    const days=t.days.map((_,i)=>{const row=rows[i];const d=blankDay(i);if(row){d.title=row[0];d.events=row.slice(1).map(name=>({...blankEvent(),name}));}else d.title=`Day ${i+1} · Plan to be confirmed`;return d;});
    confirmPlanReplacement({days,parsed:days.length});
  }
  function renderEditor(){document.getElementById('editorContent').innerHTML=`<div class="editor-shell">${state.tab==='quick'?renderQuick():state.tab==='hotel'?renderHotel():state.tab==='days'?renderDays():state.tab==='branding'?renderBranding():renderTrip()}</div>`;}
  function durationLabel(t){const n=dateDiff(t.startDate,t.endDate);return n===null||n<0?'Check travel dates':`${n} nights · ${n+1} days`;}
  const ptxt = (v,fallback='—') => esc(String(v||'').trim()||fallback);
  function getPages(t){const pages=[{key:'cover',label:'Cover',kind:'cover'},{key:'prepared',label:'Prepared for',kind:'prepared'}];
    for(let i=0;i<t.days.length;i+=7)pages.push({key:`overview:${i}`,label:i?'Overview +':'Overview',kind:'overview',from:i,to:i+7});
    if(t.hotel.name||t.hotel.description||t.hotel.photos?.length)pages.push({key:'hotel',label:'Hotel',kind:'hotel'});
    t.days.forEach((day,i)=>{const blocks=Math.max(1,Math.ceil(day.events.length/3));for(let chunk=0;chunk<blocks;chunk++)pages.push({key:`day:${i}:${chunk}`,label:`Day ${i+1}${chunk?' +':''}`,kind:'day',day:i,chunk});});
    return pages;
  }
  function paperFooter(t,number,total){return `<div class="paper-footer"><span class="f-brand">${ptxt(t.brand.name,'AL BAHAR TOURS & TRAVELS')}</span><span>Ref ${ptxt(t.reference,'—')} &nbsp; · &nbsp; ${number} / ${total}</span></div>`;}
  function contentPage(t,title,subtitle,content,number,total){return `<section class="paper-page"><div class="paper-header"><span class="head-accent"></span></div><div class="paper-padding"><div class="paper-eyebrow">PERSONALIZED TRAVEL ITINERARY</div><h2 class="paper-title">${esc(title)}</h2><div class="paper-subtitle">${esc(subtitle)}</div>${content}</div>${paperFooter(t,number,total)}</section>`;}
  function renderPaperPage(t,p,number,total){
    if(p.kind==='cover'){
      const cover=coverFor(t);
      return `<section class="paper-page doc-cover"><div class="cover-photo ${cover?'':'cover-no-photo'}" ${cover?`style="background-image:url('${attr(cover)}')"`:''}><div class="cover-overline">THE ART OF TRAVEL</div><img class="cover-logo" src="${attr(safeImage(t.brand.logo)||ASSETS.logo)}" alt="Company logo" /></div><div class="cover-bottom"><div><div class="cover-reference">PERSONALIZED JOURNEY &nbsp; / &nbsp; REF ${ptxt(t.reference)}</div><div class="cover-small-rule"></div><h1>${ptxt(t.tripTitle,'Your next journey')}</h1><div class="cover-summary"><div class="cover-stat"><small>Destination</small><strong>${ptxt(t.destination,'To be decided')}</strong></div><div class="cover-stat"><small>Travel dates</small><strong>${esc(fmtDate(t.startDate,{day:'numeric',month:'short'}))} — ${esc(fmtDate(t.endDate))}</strong></div><div class="cover-stat"><small>Duration</small><strong>${esc(durationLabel(t))}</strong></div><div class="cover-stat"><small>Travellers</small><strong>${esc(String(t.adults||0))} Adults · ${esc(String(t.children||0))} Children</strong></div></div></div><div class="cover-brand"><div><div class="company-name">${ptxt(t.brand.name)}</div><div class="company-tagline">${ptxt(t.brand.tagline,'Discover the World with Us!')}</div></div><div class="ref">PREPARED FOR &nbsp; ${ptxt(t.customer,'OUR TRAVELLER')}</div></div></div></section>`;
    }
    if(p.kind==='prepared'){
      const logo=safeImage(t.brand.logo),infoLines=[t.preparedBy.phone,t.preparedBy.email,t.brand.website].filter(Boolean).map(x=>`<div class="contact-line">${esc(x)}</div>`).join('');
      const main=`<div class="prepared-top">${logo?`<img class="brand-logo" src="${attr(logo)}" alt="Company logo"/>`:`<strong>${ptxt(t.brand.name)}</strong>`}<span class="small-meta">TRAVEL PROPOSAL · ${ptxt(t.reference)}</span></div><div class="prepared-hero"><div class="prepared-heading">Specially prepared for</div><div class="prepared-name">${ptxt(t.customer,'Our valued traveller')}</div><div class="prepared-heading">Specially prepared by</div><div class="prepared-card"><div class="prepared-by-name">${ptxt(t.preparedBy.name,'Your travel consultant')}</div><div class="prepared-staff-role">${ptxt(t.preparedBy.role,'Travel consultant')} · ${ptxt(t.brand.name)}</div>${infoLines||'<div class="contact-line">Your travel consultant will provide contact details.</div>'}</div><div class="paper-note">${ptxt(t.disclaimer,'This itinerary is a preliminary travel proposal.')}</div></div>`;
      return contentPage(t,'A journey, made for you.','',main,number,total);
    }
    if(p.kind==='overview'){
      const rows=t.days.slice(p.from,p.to).map((d,off)=>{const idx=p.from+off;let desc=d.events.map(e=>e.name).filter(Boolean).join(' · ')||'Itinerary to be planned';return `<div class="overview-row"><div class="overview-daydate">${esc(fmtDate(plusDays(t.startDate,idx),{day:'numeric',month:'short',year:'numeric'}))}<div class="small-meta">DAY ${idx+1}</div></div><div><div class="overview-activity">${ptxt(d.title,`Day ${idx+1}`)}</div></div><div><strong>${esc(desc)}</strong><p>${d.overnight?`Overnight: ${esc(d.overnight)}`:''}</p></div></div>`;}).join('');
      const hero=coverFor(t);const introStrip=`<div class="overview-scenic ${hero?'':'no-image'}" ${hero?`style="background-image:linear-gradient(90deg,rgba(8,30,51,.92),rgba(8,30,51,.25)),url('${attr(hero)}')"`:''}><span>YOUR PERSONAL JOURNEY</span><strong>${ptxt(t.destination,'The world awaits')}</strong><small>${esc(durationLabel(t))} · Thoughtfully planned, day by day</small></div>`;
      const body=`${introStrip}<div class="overview-heading"><div>DATE</div><div>DAY PLAN</div><div>SERVICES & HIGHLIGHTS</div></div>${rows}`;
      return contentPage(t,'Your itinerary',`${t.destination||'Destination to be confirmed'} · ${durationLabel(t)} · ${t.adults||0} adults · ${t.children||0} children`,body,number,total);
    }
    if(p.kind==='hotel'){
      const h=t.hotel,nightCount=dateDiff(h.checkIn,h.checkOut), nights=nightCount!=null&&nightCount>=0?String(nightCount):'—';
      const bullets=(h.highlights||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,12);
      const body=`<div class="stay-brochure"><div class="stay-brochure-top"><span>01 / ACCOMMODATION</span><span>YOUR SELECTED STAY</span></div><div class="stay-brochure-title"><div class="stay-name-block"><div class="stay-eyebrow">YOUR HOME AWAY FROM HOME</div><h3>${ptxt(h.name,'Hotel to be confirmed')}</h3><p>${ptxt(h.address||t.destination)}</p></div><div class="stay-nights"><strong>${esc(nights)}</strong><span>NIGHTS</span></div></div><div class="stay-stat-grid"><div><small>CHECK IN</small><strong>${esc(fmtDate(h.checkIn))}</strong></div><div><small>CHECK OUT</small><strong>${esc(fmtDate(h.checkOut))}</strong></div><div><small>ROOMS & CATEGORY</small><strong>${ptxt(h.roomType,'To be confirmed')}</strong></div><div><small>MEAL PLAN</small><strong>${ptxt(h.board,'To be confirmed')}</strong></div></div><div class="stay-story"><span>ABOUT YOUR STAY</span><p>${ptxt(h.description,'Your travel consultant will confirm accommodation details before departure.')}</p></div>${bullets.length?`<div class="stay-highlights"><div class="stay-section-tag">PROPERTY HIGHLIGHTS</div><div class="stay-highlights-grid">${bullets.map(x=>`<div>${icon('check',true)}<span>${esc(x)}</span></div>`).join('')}</div></div>`:''}</div>${h.notes?`<div class="stay-important"><strong>GOOD TO KNOW</strong><p>${esc(h.notes)}</p></div>`:''}`;
      return contentPage(t,'Your accommodation',`${t.destination||'Your destination'} · Hotel and room arrangements`,body,number,total);
    }
    if(p.kind==='day'){
      const d=t.days[p.day],events=d.events.slice(p.chunk*3,p.chunk*3+3);
      const items=events.map((e,i)=>`<div class="day-event"><div class="day-event-index">${String(p.chunk*3+i+1).padStart(2,'0')}</div><div class="day-event-content"><div class="day-event-top"><span class="day-event-type">${ptxt(e.type,'ACTIVITY')}</span><span class="day-event-time">${ptxt(e.time,'Time to confirm')}${e.duration?` · ${esc(e.duration)}`:''}</span></div><div class="day-event-name">${ptxt(e.name,'Activity details to be confirmed')}</div>${e.description?`<div class="day-event-desc">${esc(e.description)}</div>`:''}<div class="day-pills">${e.transfer?`<span class="day-pill">${esc(e.transfer)}</span>`:''}${e.tickets?`<span class="day-pill gold">${esc(e.tickets)}</span>`:''}</div>${e.notes?`<div class="day-notes">Note: ${esc(e.notes)}</div>`:''}</div></div>`).join('')||'<div class="no-content">Activities for this day have not yet been added.</div>';
      const meals=p.chunk===Math.max(0,Math.ceil(d.events.length/3)-1)?`<div class="day-meals">${['breakfast','lunch','dinner'].map(k=>`<div><small>${k}</small><strong class="${(d.meals?.[k]||'').toLowerCase().includes('included')&&!(d.meals?.[k]||'').toLowerCase().startsWith('not')?'included':''}">${ptxt(d.meals?.[k],'Not included')}</strong></div>`).join('')}</div>${d.overnight?`<div class="paper-note">Overnight stay: <strong>${esc(d.overnight)}</strong></div>`:''}`:'';
      const body=`<div class="day-page-heading"><span class="day-number">DAY ${String(p.day+1).padStart(2,'0')}</span><span class="day-date">${esc(fmtDay(plusDays(t.startDate,p.day)))}</span></div><h3 class="day-name">${ptxt(d.title,`Discover ${t.destination||'the destination'}`)}</h3>${p.chunk?'<div class="continuation">Continued</div>':d.overview?`<p class="day-intro">${esc(d.overview)}</p>`:''}${items}${meals}`;
      return contentPage(t,`Day ${p.day+1}`,`${t.destination||'Your destination'} · ${fmtDate(plusDays(t.startDate,p.day))}`,body,number,total);
    }
    return '';
  }
  function renderPreviewNav(){const t=active(),pages=getPages(t);if(!pages.find(p=>p.key===state.previewKey))state.previewKey=pages[0].key;document.getElementById('previewNavigation').innerHTML=pages.map(p=>`<button type="button" class="preview-tab ${p.key===state.previewKey?'active':''}" data-action="preview-page" data-key="${attr(p.key)}">${esc(p.label)}</button>`).join('');}
  let resizeObserver;
  function sizePreview(){const stage=document.getElementById('previewStage'), paper=stage.querySelector('.preview-scale');if(!paper)return;const width=Math.max(220,stage.parentElement.clientWidth);const scale=Math.min(.95,width/794);paper.style.transform=`scale(${scale})`;stage.style.width=(794*scale)+'px';stage.style.height=(paper.scrollHeight*scale)+'px';}
  function renderPreview(){const t=active(),pages=getPages(t);const index=Math.max(0,pages.findIndex(p=>p.key===state.previewKey));const el=document.getElementById('previewStage');if(!el)return;el.innerHTML=`<div class="preview-scale">${renderPaperPage(t,pages[index],index+1,pages.length)}</div>`;sizePreview();}
  function render(){renderNav();renderEditor();renderPreviewNav();renderPreview();if(state.tab==='hotel'&&state.hotelSearchOpen&&googleKey())mountHotelSearch();}
  function syncDays(t,oldStart,oldEnd,changedField){
    let diff=dateDiff(t.startDate,t.endDate);
    // If a date moves far from its partner, keep the previous trip length.
    // This lets staff change destination dates without having to edit both fields at once.
    const oldDuration=Math.max(0,Math.min(29,dateDiff(oldStart,oldEnd)||0));
    if(diff===null||diff<0||diff>29){
      if(changedField==='startDate'&&toDate(t.startDate))t.endDate=plusDays(t.startDate,oldDuration);
      else if(changedField==='endDate'&&toDate(t.endDate))t.startDate=plusDays(t.endDate,-oldDuration);
      diff=dateDiff(t.startDate,t.endDate);
    }
    if(diff===null||diff<0||diff>29){t.startDate=oldStart;t.endDate=oldEnd;showToast('Please choose a valid trip duration of 1 to 30 days.');return;}
    const need=diff+1;
    if(need<t.days.length){const removed=t.days.slice(need),hasContent=removed.some(d=>d.title||d.overview||d.events.length);if(hasContent&&!confirm(`Shortening this trip will remove ${t.days.length-need} day(s) and their activities. Continue?`)){t.startDate=oldStart;t.endDate=oldEnd;return;}}
    while(t.days.length<need)t.days.push(blankDay(t.days.length));t.days.length=need;
    state.dayIndex=Math.min(state.dayIndex,t.days.length-1);
    if(t.hotel.checkIn===oldStart)t.hotel.checkIn=t.startDate;
    if(t.hotel.checkOut===oldEnd)t.hotel.checkOut=t.endDate;
    showToast(`${need} day${need===1?'':'s'} ready for planning.`);
  }
  function switchTab(tab){state.hotelSearchOpen=false;state.tab=tab;state.mobileView='edit';document.querySelector('.workspace').classList.remove('show-preview');document.querySelectorAll('#mobileTabs button').forEach(b=>b.classList.toggle('active',b.dataset.view==='edit'));document.getElementById('sidebar').classList.remove('open');render();document.getElementById('editorPanel').scrollTop=0;}
  function eventAction(action,idx){const d=active().days[state.dayIndex];if(!d)return;
    if(action==='add-event'){d.events.push(blankEvent());}
    else if(action==='remove-event'){d.events.splice(idx,1);}
    else if(action==='duplicate-event'){const e=copy(d.events[idx]);e.id=id();d.events.splice(idx+1,0,e);}
    else if(action==='move-event-up'&&idx>0){[d.events[idx-1],d.events[idx]]=[d.events[idx],d.events[idx-1]];}
    else if(action==='move-event-down'&&idx<d.events.length-1){[d.events[idx],d.events[idx+1]]=[d.events[idx+1],d.events[idx]];}
    active().updatedAt=new Date().toISOString();save();render();
  }
  function createTrip(){if(state.trips.length>=50){showToast('Maximum of 50 browser-saved itineraries. Export old files first.');return;}const t=makeBlank();const prev=active();if(prev){t.brand=copy(prev.brand);t.preparedBy=copy(prev.preparedBy);}state.trips.unshift(t);state.activeId=t.id;state.tab='quick';state.dayIndex=0;state.previewKey='cover';save();render();showToast('New itinerary created.');}
  function duplicateTrip(){if(state.trips.length>=50){showToast('Browser library is full. Export old itineraries first.');return;}const t=copy(active());t.id=id();t.tripTitle=(t.tripTitle||'Itinerary')+' — Copy';t.reference=`AB-${String(Date.now()).slice(-6)}`;t.updatedAt=new Date().toISOString();state.trips.unshift(t);state.activeId=t.id;state.previewKey='cover';state.tab='quick';state.dayIndex=0;save();render();showToast('Itinerary duplicated.');}
  function downloadJson(){const t=active();const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),itinerary:t},null,2)],{type:'application/json'});downloadBlob(blob,`${slug(t.tripTitle||'itinerary')}-${slug(t.reference||'draft')}.json`);showToast('Itinerary backup downloaded.');}
  function slug(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,55)||'itinerary';}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
  function startPrint(){const t=active(),warnings=[];if(!t.customer.trim())warnings.push('Customer name is empty');if(!t.destination.trim())warnings.push('Destination is empty');if(!t.preparedBy.name.trim())warnings.push('Prepared-by employee name is empty');if(!coverFor(t))warnings.push('No cover image available for this destination');if(t.days.some(d=>!d.title.trim()||!d.events.length))warnings.push('Some days have no heading or activities');if(warnings.length){modal('Review before exporting',`The itinerary is printable, but you may want to complete these fields:<br><br>${warnings.map(w=>`• ${esc(w)}`).join('<br>')}<br><br>Continue to the PDF print dialog?`,[{label:'Return to editor',action:()=>{}},{label:'Export anyway',primary:true,action:doPrint}]);return;}doPrint();}
  function doPrint(){const t=active(),pages=getPages(t);document.getElementById('printRoot').innerHTML=pages.map((p,i)=>renderPaperPage(t,p,i+1,pages.length)).join('');showToast('Choose “Save as PDF” as the destination in the browser print dialog.');setTimeout(()=>window.print(),120);}
  async function optimizeImage(file,max=1400){if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type)){showToast('Please choose a JPG, PNG or WebP image.');return null;}if(file.size>18*1024*1024){showToast('Please choose an image smaller than 18 MB.');return null;}
    try{const url=URL.createObjectURL(file);const image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const scale=Math.min(1,max/Math.max(image.width,image.height));const cvs=document.createElement('canvas');cvs.width=Math.max(1,Math.round(image.width*scale));cvs.height=Math.max(1,Math.round(image.height*scale));const ctx=cvs.getContext('2d');ctx.drawImage(image,0,0,cvs.width,cvs.height);return cvs.toDataURL(max===1100&&file.type==='image/png'?'image/png':file.type==='image/png'&&file.size<200000?'image/png':'image/jpeg',.79);}finally{URL.revokeObjectURL(url);}}catch(e){showToast('Could not process this image.');return null;}
  }
  async function handleImageUpload(input){const type=input.dataset.upload,t=active(),files=Array.from(input.files||[]);if(!files.length)return;const max=type==='logo'?1100:1400;for(const file of files){const result=await optimizeImage(file,max);if(!result)continue;if(type==='cover')t.coverImage=result;else if(type==='logo')t.brand.logo=result;else if(type==='hotel'){if(t.hotel.photos.length>=6)break;t.hotel.photos.push(result);}}
    t.updatedAt=new Date().toISOString();save();render();showToast('Image added to itinerary.');
  }
  async function handleImport(file){if(!file)return;try{if(file.size>12*1024*1024)throw Error('Backup file is too large.');const raw=JSON.parse(await file.text());let trip=hydrateTrip(raw.itinerary||raw);trip.id=id();if(state.trips.length>=50)throw Error('Saved itinerary limit reached.');state.trips.unshift(trip);state.activeId=trip.id;state.tab='quick';state.dayIndex=0;state.previewKey='cover';save();render();showToast('Itinerary imported successfully.');}catch(e){showToast(`Cannot import: ${e.message||'invalid file'}`);}}
  document.addEventListener('focusin',e=>{if(e.target.matches('[data-field="destination"]'))e.target.dataset.startValue=e.target.value;});
  document.addEventListener('input', e=>{const node=e.target;if(node.matches('[data-quick-plan]')){active().quickText=node.value.slice(0,30000);save();return;}if(!node.matches('[data-field]'))return;if(node.type==='date'||node.tagName==='SELECT')return;const t=active(),path=node.dataset.field;set(t,path,node.type==='number'?Math.max(0,Number(node.value)||0):node.value);t.updatedAt=new Date().toISOString();save();renderPreviewNav();renderPreview();});
  document.addEventListener('change', e=>{
    const el=e.target;if(el.matches('[data-upload]')){handleImageUpload(el);return;}
    if(!el.matches('[data-field]'))return;
    // Text fields were already handled on input; re-rendering on their blur can
    // detach the user's next clicked button before its click event fires.
    if(el.dataset.field==='destination'){
      const t=active(),chosen=safeImage(t.coverImage),d=catalogDestination(t);
      if(el.value !== (el.dataset.startValue??el.value)){t.coverImage='';if(!t.tripTitle||t.tripTitle==='Your next journey'||t.tripTitle===`Trip to ${el.dataset.startValue}`)t.tripTitle=`Trip to ${el.value||'your destination'}`;}
      else if(chosen.startsWith('assets/destinations/') && !catalogImages(d).some(x=>x.src===chosen))t.coverImage='';
      save();render();return;
    }
    if(el.type!=='date' && el.tagName!=='SELECT')return;
    const t=active(),path=el.dataset.field,oldStart=t.startDate,oldEnd=t.endDate;
    const v=el.type==='number'?Math.max(0,Number(el.value)||0):el.value;
    set(t,path,v);
    if(path==='startDate'||path==='endDate')syncDays(t,oldStart,oldEnd,path);
    t.updatedAt=new Date().toISOString();save();render();
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;const act=btn.dataset.action,t=active();
    if(act==='save-google-key'){
      const value=document.getElementById('googleKeyInput')?.value.trim()||'';
      if(!/^[a-zA-Z0-9_-]{20,200}$/.test(value)){showToast('Enter a valid Google Maps API key.');return;}
      try{localStorage.setItem(GOOGLE_KEY_STORAGE,value);}catch(e){showToast('Could not save the Google key in this browser.');return;}
      state.hotelSearchOpen=false;render();showToast('Google key saved in this browser. Click Search hotels to connect.');return;
    }
    if(act==='clear-google-key'){
      localStorage.removeItem(GOOGLE_KEY_STORAGE);state.hotelSearchOpen=false;render();
      showToast('Key removed. Reload the page before connecting with a different key.');return;
    }
    if(act==='open-google-hotel'){
      if(!googleKey()){showToast('Add your restricted Google Maps API key first.');return;}
      state.hotelSearchOpen=true;render();return;
    }
    if(act==='toggle-menu'){document.getElementById('sidebar').classList.toggle('open');return;}
    if(act==='tab'){switchTab(btn.dataset.tab);return;}
    if(act==='new-trip'){createTrip();return;}
    if(act==='open-trip'){state.activeId=btn.dataset.id;state.tab='quick';state.dayIndex=0;state.previewKey='cover';save();switchTab('quick');return;}
    if(act==='duplicate-trip'){duplicateTrip();return;}
    if(act==='apply-quick-plan'){const result=planFromText(t.quickText,t);if(result.error)showToast(result.error);else confirmPlanReplacement(result);return;}
    if(act==='load-quick-example'){t.quickText=quickExample;save();render();showToast('Example loaded. Replace the sample activities with the confirmed plan.');return;}
    if(act==='quick-template'){applyStarter();return;}
    if(act==='edit-quick-day'){state.dayIndex=Math.max(0,Number(btn.dataset.index)||0);state.previewKey=`day:${state.dayIndex}:0`;switchTab('days');return;}
    if(act==='print'){startPrint();return;}
    if(act==='download-json'){downloadJson();return;}
    if(act==='preview-page'){state.previewKey=btn.dataset.key;renderPreviewNav();renderPreview();return;}
    if(act==='pick-day'){state.dayIndex=Number(btn.dataset.index);state.previewKey=`day:${state.dayIndex}:0`;render();return;}
    if(act==='next-day'){state.dayIndex=Math.min(t.days.length-1,state.dayIndex+1);state.previewKey=`day:${state.dayIndex}:0`;render();document.getElementById('editorPanel').scrollTop=0;return;}
    if(['add-event','remove-event','duplicate-event','move-event-up','move-event-down'].includes(act)){eventAction(act,Number(btn.dataset.event));return;}
    if(act==='clear-day'){modal('Clear this day?',`This will erase the selected day’s title, description and all activities. Other days are not affected.`,[{label:'Cancel'},{label:'Clear this day',danger:true,action:()=>{t.days[state.dayIndex]=blankDay();save();render();}}]);return;}
    if(act==='duplicate-day'){if(t.days.length>=30){showToast('The demo supports up to 30 itinerary days.');return;}const d=copy(t.days[state.dayIndex]);d.id=id();d.events.forEach(e=>e.id=id());t.days.splice(state.dayIndex+1,0,d);t.endDate=plusDays(t.startDate,t.days.length-1);state.dayIndex++;state.previewKey=`day:${state.dayIndex}:0`;save();render();showToast('Day copied and trip extended.');return;}
    if(act==='select-cover'){const d=catalogDestination(t),valid=catalogImages(d);if(!valid.some(x=>x.src===btn.dataset.src)){showToast('Please choose an image from this destination.');return;}t.coverImage=btn.dataset.src;t.updatedAt=new Date().toISOString();save();render();showToast('Destination cover updated.');return;}
    if(act==='reset-cover'){t.coverImage='';save();render();showToast('Using the default destination cover.');return;}
    if(act==='remove-cover'){t.coverImage='';save();render();return;}
    if(act==='remove-hotel-photo'){t.hotel.photos.splice(Number(btn.dataset.index),1);save();render();return;}
    if(act==='reset-logo'){t.brand.logo=ASSETS.logo;save();render();return;}
    if(act==='mobile-view'){state.mobileView=btn.dataset.view;document.querySelector('.workspace').classList.toggle('show-preview',state.mobileView==='preview');document.querySelectorAll('#mobileTabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===state.mobileView));sizePreview();return;}
  });
  document.getElementById('importFile').addEventListener('change',e=>{handleImport(e.target.files?.[0]);e.target.value='';});
  window.addEventListener('resize',sizePreview);
  window.addEventListener('afterprint',()=>{document.getElementById('printRoot').innerHTML='';});
  // Provide reachable actions for import and delete through a nonintrusive menu attached in settings.
  const extraStyles=document.createElement('style');extraStyles.textContent='.quick-tools{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:16px}';document.head.append(extraStyles);
  const oldRenderBranding=renderBranding;
  renderBranding=function(){return oldRenderBranding()+`<div class="section-card"><div class="card-head"><div><h3>Workspace tools</h3><p>Manage your saved demo itineraries.</p></div><span class="card-symbol">${icon('settings')}</span></div><div class="quick-tools"><button class="btn btn-quiet btn-mini" data-action="import-json">Import JSON backup</button><button class="btn btn-danger btn-mini" data-action="delete-trip">Delete this itinerary</button></div>${info('All drafts are saved in this browser only. Export JSON backups regularly. The GitHub Pages demo does not sync data between employees or devices.')}</div>`;};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='import-json')document.getElementById('importFile').click();if(b.dataset.action==='delete-trip'){modal('Delete this itinerary?',`The current itinerary will be permanently removed from this browser’s saved drafts. Back it up first if necessary.`,[{label:'Cancel'},{label:'Delete itinerary',danger:true,action:()=>{state.trips=state.trips.filter(t=>t.id!==state.activeId);if(!state.trips.length)state.trips=[makeBlank()];state.activeId=state.trips[0].id;state.tab='quick';state.dayIndex=0;state.previewKey='cover';save();render();showToast('Itinerary deleted.');}}]);}});
  document.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon,true);});
  load();render();
})();
