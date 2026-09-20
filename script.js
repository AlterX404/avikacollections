const products = [
  {id:'rust-kurta',name:'The sunlit kurta',brand:'Rang Studio',category:'Women',price:2299,color:'Rust',image:'./assets/images/kurta.webp',description:'A warm rust kurta with understated detailing and an easy silhouette.',material:'Cotton blend',fit:'Regular'},
  {id:'ivory-linen-shirt',name:'The easy linen shirt',brand:'Studio North',category:'Men',price:1699,color:'Ivory',image:'./assets/images/shirt.webp',description:'A relaxed shirt for unhurried mornings and everyday plans.',material:'Linen blend',fit:'Relaxed'},
  {id:'indigo-overshirt',name:'The weekend overshirt',brand:'Studio North',category:'Men',price:2499,color:'Indigo',image:'./assets/images/overshirt.webp',description:'An indigo layer to wear open over a favourite tee or buttoned up.',material:'Cotton denim',fit:'Relaxed'},
  {id:'everyday-tote',name:'The everyday carryall',brand:'Mysa Goods',category:'Accessories',price:1899,color:'Tan',image:'./assets/images/bag.webp',description:'A roomy tote for the things that make up your day.',material:'Synthetic leather',fit:'One size'}
];
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const grid=document.getElementById('productGrid'), empty=document.getElementById('emptyState'), search=document.getElementById('searchInput');
let active='All';
function render(){
  const q=(search.value||'').trim().toLowerCase();
  const list=products.filter(p=>(active==='All'||p.category===active)&&(!q||[p.name,p.brand,p.category,p.color].join(' ').toLowerCase().includes(q)));
  grid.innerHTML=list.map(p=>`<article class="product-card reveal visible"><div class="product-image" data-open="${p.id}"><img src="${p.image}" alt="${p.name}" loading="lazy"><span class="sample-tag">COLLECTION</span><button class="quick-button" data-open="${p.id}" aria-label="View ${p.name}">↗</button></div><div class="product-meta"><p class="product-brand">${p.brand}</p><h3 class="product-title">${p.name}</h3><div class="product-bottom"><strong>${money(p.price)}</strong><span>${p.color}</span></div></div></article>`).join('');
  empty.hidden=!!list.length;
}
render();
search.addEventListener('input',render);
document.querySelectorAll('.pill').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.pill').forEach(x=>x.classList.remove('active'));btn.classList.add('active');active=btn.dataset.filter;render()}));
document.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{active=btn.dataset.category;document.querySelectorAll('.pill').forEach(x=>x.classList.toggle('active',x.dataset.filter===active));render();document.getElementById('products').scrollIntoView({behavior:'smooth'})}));
document.querySelectorAll('.main-nav [data-filter]').forEach(a=>a.addEventListener('click',()=>{active=a.dataset.filter;document.querySelectorAll('.pill').forEach(x=>x.classList.toggle('active',x.dataset.filter===active));setTimeout(render,0)}));
document.getElementById('showAll').addEventListener('click',()=>{active='All';search.value='';document.querySelectorAll('.pill').forEach(x=>x.classList.toggle('active',x.dataset.filter==='All'));render()});
document.getElementById('searchButton').addEventListener('click',()=>{document.getElementById('products').scrollIntoView({behavior:'smooth'});setTimeout(()=>search.focus(),450)});

const menu=document.getElementById('mainNav'), toggle=document.getElementById('menuToggle');
toggle.addEventListener('click',()=>{const open=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open))});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false')}));

const dialog=document.getElementById('productDialog');let current=null;
function openProduct(id){const p=products.find(x=>x.id===id);if(!p)return;current=p;dialog.querySelector('#dialogImage').src=p.image;dialog.querySelector('#dialogImage').alt=p.name;dialog.querySelector('#dialogBrand').textContent=p.brand;dialog.querySelector('#dialogName').textContent=p.name;dialog.querySelector('#dialogPrice').textContent=money(p.price);dialog.querySelector('#dialogDescription').textContent=p.description;dialog.querySelector('#dialogMaterial').textContent=p.material;dialog.querySelector('#dialogFit').textContent=p.fit;dialog.showModal()}
document.addEventListener('click',e=>{const hit=e.target.closest('[data-open]');if(hit)openProduct(hit.dataset.open)});
document.getElementById('dialogClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});

let bag=JSON.parse(localStorage.getItem('avika-bag')||'[]');
const drawer=document.getElementById('bagDrawer'), backdrop=document.getElementById('drawerBackdrop');
function saveBag(){localStorage.setItem('avika-bag',JSON.stringify(bag));renderBag()}
function renderBag(){
  document.getElementById('bagCount').textContent=bag.reduce((n,x)=>n+x.qty,0);
  const box=document.getElementById('bagItems');
  if(!bag.length) box.innerHTML='<p class="muted" style="padding:28px 0">Your bag is waiting for a good find.</p>';
  else box.innerHTML=bag.map(x=>{const p=products.find(y=>y.id===x.id);return `<div class="bag-item"><img src="${p.image}" alt=""><div><h4>${p.name}</h4><p>${money(p.price)} · Qty ${x.qty}</p></div><button data-remove="${p.id}">Remove</button></div>`}).join('');
  document.getElementById('bagTotal').textContent=money(bag.reduce((n,x)=>{const p=products.find(y=>y.id===x.id);return n+p.price*x.qty},0));
}
function openBag(){drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');backdrop.hidden=false}
function closeBag(){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');backdrop.hidden=true}
document.getElementById('bagButton').addEventListener('click',openBag);document.getElementById('closeBag').addEventListener('click',closeBag);backdrop.addEventListener('click',closeBag);
document.getElementById('dialogAdd').addEventListener('click',()=>{if(!current)return;const line=bag.find(x=>x.id===current.id);line?line.qty++:bag.push({id:current.id,qty:1});saveBag();dialog.close();openBag()});
document.getElementById('bagItems').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;bag=bag.filter(x=>x.id!==b.dataset.remove);saveBag()});
renderBag();

document.getElementById('year').textContent=new Date().getFullYear();
const io=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('visible');io.unobserve(x.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(x=>io.observe(x));
