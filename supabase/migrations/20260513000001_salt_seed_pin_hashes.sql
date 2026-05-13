-- Normalize legacy seed PIN hashes to the app's salted PIN hash format.
update public.users
set pin_hash = case pin_hash
  when encode(digest('1234','sha256'),'hex') then 'c0296a3c45f6c387d5f55a970ee4804fd703b9dceb27b5c72ae28fcf7443e94b'
  when encode(digest('1111','sha256'),'hex') then 'f30d56e18b61a48c61dbff83251f15476e556fe1948c7d3f32bc42bbaa3a963a'
  when encode(digest('2222','sha256'),'hex') then '4ec53187622a27a67ab2a39202d6f8a3e50461d90043bed498ab600cdf51a94b'
  when encode(digest('3333','sha256'),'hex') then '20b3bfceae054368b81db0e9440e36dc9f69e6eccc21ba803346c9815e56ea44'
  when encode(digest('4444','sha256'),'hex') then '62744200af8c102c8785af87e734bb711b1f3d78239f9e932fe49060e3a89247'
  else pin_hash
end
where pin_hash in (
  encode(digest('1234','sha256'),'hex'),
  encode(digest('1111','sha256'),'hex'),
  encode(digest('2222','sha256'),'hex'),
  encode(digest('3333','sha256'),'hex'),
  encode(digest('4444','sha256'),'hex')
);
