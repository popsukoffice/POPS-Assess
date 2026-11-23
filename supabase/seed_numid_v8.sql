-- POPS Assess v8: Reading numbers (start of Maths). Original items.
delete from public.assess_items where test_key='numid';
delete from public.assess_tests where key='numid';
insert into public.assess_tests(key,title,intro,stop_after,sort,stop_mode) values ('numid','Maths: reading numbers','Read the numbers out loud, one row at a time.',999,20,'consec');
insert into public.assess_items(test_key,ord,item_id,level,skill,payload,answer) values
('numid',1,'nr001',1,'numbers 0 to 10','{"type":"numid","text":"7","part":1,"pos":1}'::jsonb,'{"value":7}'::jsonb),
('numid',2,'nr002',1,'numbers 0 to 10','{"type":"numid","text":"2","part":1,"pos":2}'::jsonb,'{"value":2}'::jsonb),
('numid',3,'nr003',1,'numbers 0 to 10','{"type":"numid","text":"10","part":1,"pos":3}'::jsonb,'{"value":10}'::jsonb),
('numid',4,'nr004',1,'numbers 0 to 10','{"type":"numid","text":"0","part":1,"pos":4}'::jsonb,'{"value":0}'::jsonb),
('numid',5,'nr005',1,'numbers 0 to 10','{"type":"numid","text":"5","part":1,"pos":5}'::jsonb,'{"value":5}'::jsonb),
('numid',6,'nr006',1,'numbers 0 to 10','{"type":"numid","text":"9","part":1,"pos":6}'::jsonb,'{"value":9}'::jsonb),
('numid',7,'nr007',1,'numbers 0 to 10','{"type":"numid","text":"3","part":1,"pos":7}'::jsonb,'{"value":3}'::jsonb),
('numid',8,'nr008',1,'numbers 0 to 10','{"type":"numid","text":"6","part":1,"pos":8}'::jsonb,'{"value":6}'::jsonb),
('numid',9,'nr009',1,'numbers 0 to 10','{"type":"numid","text":"1","part":1,"pos":9}'::jsonb,'{"value":1}'::jsonb),
('numid',10,'nr010',1,'numbers 0 to 10','{"type":"numid","text":"8","part":1,"pos":10}'::jsonb,'{"value":8}'::jsonb),
('numid',11,'nr011',1,'numbers 0 to 10','{"type":"numid","text":"4","part":1,"pos":11}'::jsonb,'{"value":4}'::jsonb),
('numid',12,'nr012',1,'numbers 11 to 100','{"type":"numid","text":"53","part":2,"pos":1}'::jsonb,'{"value":53}'::jsonb),
('numid',13,'nr013',1,'numbers 11 to 100','{"type":"numid","text":"16","part":2,"pos":2}'::jsonb,'{"value":16}'::jsonb),
('numid',14,'nr014',1,'numbers 11 to 100','{"type":"numid","text":"90","part":2,"pos":3}'::jsonb,'{"value":90}'::jsonb),
('numid',15,'nr015',1,'numbers 11 to 100','{"type":"numid","text":"72","part":2,"pos":4}'::jsonb,'{"value":72}'::jsonb),
('numid',16,'nr016',1,'numbers 11 to 100','{"type":"numid","text":"29","part":2,"pos":5}'::jsonb,'{"value":29}'::jsonb),
('numid',17,'nr017',1,'numbers 11 to 100','{"type":"numid","text":"100","part":2,"pos":6}'::jsonb,'{"value":100}'::jsonb),
('numid',18,'nr018',1,'numbers 11 to 100','{"type":"numid","text":"47","part":2,"pos":7}'::jsonb,'{"value":47}'::jsonb),
('numid',19,'nr019',1,'numbers 11 to 100','{"type":"numid","text":"81","part":2,"pos":8}'::jsonb,'{"value":81}'::jsonb),
('numid',20,'nr020',1,'numbers 11 to 100','{"type":"numid","text":"34","part":2,"pos":9}'::jsonb,'{"value":34}'::jsonb),
('numid',21,'nr021',1,'numbers 11 to 100','{"type":"numid","text":"68","part":2,"pos":10}'::jsonb,'{"value":68}'::jsonb);
