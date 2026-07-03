insert into public.quality_criteria(key,label_vi,label_en,weight,active,sort_order) values
('profile_completeness','Độ hoàn thiện hồ sơ','Profile completeness',15,true,10),
('financials_quality','Chất lượng số liệu tài chính','Financial data quality',20,true,20),
('data_confidence','Độ tin cậy nguồn dữ liệu','Data source confidence',15,true,30),
('deal_terms','Điều khoản giao dịch rõ ràng','Deal terms clarity',10,true,40),
('documents','Tài liệu/Data room','Documents and data room',15,true,50),
('valuation_reason','Logic định giá','Valuation rationale',10,true,60),
('growth_margin','Tăng trưởng & biên lợi nhuận','Growth and margin profile',10,true,70),
('admin_review','Đã được admin rà soát','Admin reviewed',5,true,80)
on conflict (key) do update set label_vi=excluded.label_vi,label_en=excluded.label_en,weight=excluded.weight,active=excluded.active,sort_order=excluded.sort_order;
